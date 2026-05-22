"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { composeMarkedDataUrl, downsampleDataUrl } from "@/lib/canvas-mark";
import { VisionModelPicker } from "@/app/components/VisionModelPicker";
import type { ParcelLookupResult } from "@/app/components/AddressInput";

const MARK_INPUT_MAX_SIDE = 1024;
const VERTEX_HIT_RADIUS = 0.025; // normalized

export type EditorTile = {
  pageIndex: number;
  rawDataUrl: string;
  markedDataUrl: string | null;
  pageText: string;
  polygon: Array<[number, number]>;
  mark?: {
    visible: boolean;
    confidence: number;
    rationale: string;
    modelUsed: string;
  };
};

export function PageDetailEditor({
  tile,
  totalPages,
  parcel,
  referenceImageDataUrl,
  defaultModel,
  onSave,
  onClose,
  onNavigate,
  baseFilename,
}: {
  tile: EditorTile;
  totalPages: number;
  parcel: ParcelLookupResult;
  referenceImageDataUrl: string | null;
  defaultModel: string;
  onSave: (updated: EditorTile) => void;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  baseFilename?: string;
}) {
  const [polygon, setPolygon] = useState<Array<[number, number]>>(tile.polygon ?? []);
  const [manualMode, setManualMode] = useState(false);
  const [model, setModel] = useState(defaultModel);
  const [marking, setMarking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mark, setMark] = useState(tile.mark);
  const [dirty, setDirty] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const draggingIdx = useRef<number | null>(null);

  // Reset state when navigating to a different tile
  useEffect(() => {
    setPolygon(tile.polygon ?? []);
    setMark(tile.mark);
    setErr(null);
    setManualMode(false);
    setDirty(false);
  }, [tile.pageIndex]); // intentionally ignore changes to tile object identity

  // Load image and draw
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = tile.rawDataUrl;
  }, [tile.rawDataUrl]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    // Use natural image dimensions; CSS scales it down for display.
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    if (polygon.length >= 3) {
      ctx.beginPath();
      const [fx, fy] = polygon[0];
      ctx.moveTo(fx * canvas.width, fy * canvas.height);
      for (let i = 1; i < polygon.length; i++) {
        const [x, y] = polygon[i];
        ctx.lineTo(x * canvas.width, y * canvas.height);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.95)";
      ctx.lineWidth = Math.max(4, Math.round(canvas.width / 250));
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    if (manualMode && polygon.length > 0) {
      const r = Math.max(8, Math.round(canvas.width / 140));
      polygon.forEach(([x, y]) => {
        const px = x * canvas.width;
        const py = y * canvas.height;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.95)";
        ctx.lineWidth = Math.max(2, r / 4);
        ctx.stroke();
      });
    }
  }, [polygon, manualMode]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Canvas mouse handling — all coords normalized 0..1
  const getNormalized = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!manualMode) return;
      const { x, y } = getNormalized(e);
      let nearestIdx = -1;
      let nearestDist = VERTEX_HIT_RADIUS;
      polygon.forEach(([vx, vy], i) => {
        const d = Math.hypot(vx - x, vy - y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      });

      if (nearestIdx >= 0) {
        if (e.shiftKey) {
          setPolygon((prev) => prev.filter((_, i) => i !== nearestIdx));
          setDirty(true);
        } else {
          draggingIdx.current = nearestIdx;
        }
      } else {
        // add new vertex; insert at nearest edge for cleaner polygons when 3+ exist
        if (polygon.length < 3) {
          setPolygon((prev) => [...prev, [x, y]]);
        } else {
          let bestEdge = 0;
          let bestDist = Infinity;
          for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i];
            const b = polygon[(i + 1) % polygon.length];
            const d = pointSegmentDistance([x, y], a, b);
            if (d < bestDist) {
              bestDist = d;
              bestEdge = i;
            }
          }
          setPolygon((prev) => {
            const next = [...prev];
            next.splice(bestEdge + 1, 0, [x, y]);
            return next;
          });
        }
        setDirty(true);
      }
    },
    [manualMode, polygon, getNormalized]
  );

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (draggingIdx.current === null) return;
      const { x, y } = getNormalized(e);
      const idx = draggingIdx.current;
      setPolygon((prev) => prev.map((p, i) => (i === idx ? [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))] : p)));
      setDirty(true);
    },
    [getNormalized]
  );

  const onCanvasMouseUp = useCallback(() => {
    draggingIdx.current = null;
  }, []);

  async function remarkWithVision() {
    if (marking) return;
    setMarking(true);
    setErr(null);
    try {
      const downsampled = await downsampleDataUrl(tile.rawDataUrl, MARK_INPUT_MAX_SIDE, 0.85);
      const res = await fetch("/api/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: downsampled,
          parcel: parcel.parcel,
          address: parcel.addressNormalized,
          referenceImageDataUrl: referenceImageDataUrl ?? null,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      const newPolygon = Array.isArray(data.pixelPolygon) ? (data.pixelPolygon as Array<[number, number]>) : [];
      setPolygon(newPolygon);
      setMark({
        visible: Boolean(data.visible),
        confidence: Number(data.confidence ?? 0),
        rationale: String(data.rationale ?? ""),
        modelUsed: String(data.modelUsed ?? model),
      });
      setDirty(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setMarking(false);
    }
  }

  async function save() {
    const markedDataUrl =
      polygon.length >= 3 ? await composeMarkedDataUrl(tile.rawDataUrl, polygon) : null;
    onSave({
      ...tile,
      polygon,
      markedDataUrl,
      mark,
    });
  }

  function downloadCurrent() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    const base = (baseFilename ?? "aerial").replace(/\.[^.]+$/, "");
    a.download = `${base}-page-${String(tile.pageIndex + 1).padStart(2, "0")}-marked.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            Page editor
          </div>
          <h2 className="text-lg font-semibold">
            Page {tile.pageIndex + 1} of {totalPages}
            {dirty && <span className="ml-2 text-[11px] font-normal text-warn">· unsaved</span>}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(-1)}
            disabled={tile.pageIndex === 0}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/30 disabled:opacity-40"
          >
            ◀ Prev
          </button>
          <button
            onClick={() => onNavigate(1)}
            disabled={tile.pageIndex >= totalPages - 1}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/30 disabled:opacity-40"
          >
            Next ▶
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/30"
          >
            ✕ Close
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 md:grid-cols-[1fr_320px]">
        <div className="relative flex items-center justify-center overflow-auto rounded-2xl border border-border bg-foreground/[0.04]">
          <canvas
            ref={canvasRef}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            className={`max-h-full max-w-full ${manualMode ? "cursor-crosshair" : "cursor-default"}`}
            style={{ touchAction: "none" }}
          />
          {marking && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-medium">
              Re-marking with {findModelLabel(model)}…
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 overflow-auto">
          <VisionModelPicker value={model} onChange={setModel} disabled={marking} />

          <button
            onClick={remarkWithVision}
            disabled={marking}
            className="inline-flex h-10 items-center justify-center rounded-full bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {marking ? "Re-marking…" : "↻ Re-mark with vision"}
          </button>

          <button
            onClick={() => setManualMode((v) => !v)}
            className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium ${
              manualMode
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-background text-foreground hover:border-foreground/30"
            }`}
          >
            {manualMode ? "✓ Manual edit on" : "✏ Manual edit"}
          </button>

          {manualMode && (
            <div className="rounded-lg border border-border bg-background p-3 text-[11px] leading-5 text-muted">
              <div className="font-medium text-foreground">Manual edit controls</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>Click an empty spot to add a vertex</li>
                <li>Drag a vertex (white dot) to move it</li>
                <li>Shift-click a vertex to delete it</li>
              </ul>
              {polygon.length > 0 && (
                <button
                  onClick={() => {
                    setPolygon([]);
                    setDirty(true);
                  }}
                  className="mt-2 text-[11px] text-error underline-offset-2 hover:underline"
                >
                  Clear polygon ({polygon.length} vertices)
                </button>
              )}
            </div>
          )}

          {mark && (
            <div className="rounded-lg border border-border bg-card p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-muted">Last vision result</span>
                {mark.visible ? (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    boundary · {(mark.confidence * 100).toFixed(0)}%
                  </span>
                ) : (
                  <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-semibold text-muted">
                    no map
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-5 text-foreground/80">{mark.rationale}</p>
              <p className="mt-1 text-[10px] text-muted">model: {mark.modelUsed}</p>
            </div>
          )}

          {tile.pageText && (
            <details className="rounded-lg border border-border bg-card p-3 text-xs">
              <summary className="cursor-pointer font-medium">PDF page text</summary>
              <p className="mt-2 max-h-40 overflow-auto text-[11px] leading-5 text-muted">
                {tile.pageText}
              </p>
            </details>
          )}

          {err && (
            <div className="rounded-lg border border-error/40 bg-error/10 p-3 text-[11px] text-error">
              {err}
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
            <button
              onClick={downloadCurrent}
              className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-4 text-xs font-medium hover:border-foreground/30"
            >
              ↓ Download current view
            </button>
            <button
              onClick={save}
              disabled={!dirty}
              className="inline-flex h-10 items-center justify-center rounded-full bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dirty ? "Save changes" : "No changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function pointSegmentDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function findModelLabel(id: string): string {
  // Avoid a sync import dependency cycle — derive label from id.
  if (id.includes("sonnet")) return "Claude Sonnet 4.5";
  if (id.includes("haiku")) return "Claude Haiku 4.5";
  if (id.includes("gpt-5")) return "GPT-5";
  if (id.includes("gemini")) return "Gemini 2.5 Flash";
  return id;
}
