"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { composeMarkedDataUrl, downsampleDataUrl } from "@/lib/canvas-mark";
import { VisionModelPicker } from "@/app/components/VisionModelPicker";
import type { ParcelLookupResult } from "@/app/components/AddressInput";

const MARK_INPUT_MAX_SIDE = 1024;
const VERTEX_HIT_RADIUS = 0.025;

type EditMode = "vertex" | "translate";

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
  navigableIndices,
  parcel,
  referenceImageDataUrl,
  previousMarkedImageDataUrl,
  previousMarkedPolygon,
  defaultModel,
  onSave,
  onClose,
  onNavigate,
  baseFilename,
}: {
  tile: EditorTile;
  totalPages: number;
  navigableIndices: number[];
  parcel: ParcelLookupResult;
  referenceImageDataUrl: string | null;
  previousMarkedImageDataUrl: string | null;
  previousMarkedPolygon: Array<[number, number]> | null;
  defaultModel: string;
  onSave: (updated: EditorTile, wasManual: boolean) => void;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  baseFilename?: string;
}) {
  const [polygon, setPolygon] = useState<Array<[number, number]>>(() => {
    // Prefill from previous save when this tile has no polygon yet.
    if ((!tile.polygon || tile.polygon.length === 0) && previousMarkedPolygon && previousMarkedPolygon.length >= 3) {
      return previousMarkedPolygon;
    }
    return tile.polygon ?? [];
  });
  const [editEnabled, setEditEnabled] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>("vertex");
  const [usedManualThisSession, setUsedManualThisSession] = useState(false);
  const [model, setModel] = useState(defaultModel);
  const [marking, setMarking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mark, setMark] = useState(tile.mark);
  const [dirty, setDirty] = useState(() => {
    // If we prefilled from previous, the page is dirty (different from saved state)
    return (!tile.polygon || tile.polygon.length === 0) && !!previousMarkedPolygon && previousMarkedPolygon.length >= 3;
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const draggingVertexIdx = useRef<number | null>(null);
  const translateAnchor = useRef<{ x: number; y: number } | null>(null);

  // Reset state when navigating to a different tile
  useEffect(() => {
    const hasOwnPolygon = tile.polygon && tile.polygon.length >= 3;
    const canPrefill = previousMarkedPolygon && previousMarkedPolygon.length >= 3;
    if (hasOwnPolygon) {
      setPolygon(tile.polygon);
      setDirty(false);
    } else if (canPrefill) {
      setPolygon(previousMarkedPolygon);
      setDirty(true); // prefilled, so saving will record it
    } else {
      setPolygon([]);
      setDirty(false);
    }
    setMark(tile.mark);
    setErr(null);
    setEditEnabled(false);
    setEditMode("vertex");
    setUsedManualThisSession(false);
  }, [tile.pageIndex, tile.polygon, tile.mark, previousMarkedPolygon]);

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

    if (editEnabled && editMode === "vertex" && polygon.length > 0) {
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
  }, [polygon, editEnabled, editMode]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

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
      if (!editEnabled) return;
      const { x, y } = getNormalized(e);

      if (editMode === "translate") {
        // Start translating if we have a polygon and click was inside or near it.
        if (polygon.length >= 3) {
          translateAnchor.current = { x, y };
          setUsedManualThisSession(true);
        }
        return;
      }

      // Vertex mode
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
          setUsedManualThisSession(true);
        } else {
          draggingVertexIdx.current = nearestIdx;
        }
      } else {
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
        setUsedManualThisSession(true);
      }
    },
    [editEnabled, editMode, polygon, getNormalized]
  );

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!editEnabled) return;
      const { x, y } = getNormalized(e);

      if (editMode === "translate" && translateAnchor.current) {
        const dx = x - translateAnchor.current.x;
        const dy = y - translateAnchor.current.y;
        translateAnchor.current = { x, y };
        setPolygon((prev) =>
          prev.map(([px, py]) => [
            Math.max(0, Math.min(1, px + dx)),
            Math.max(0, Math.min(1, py + dy)),
          ] as [number, number])
        );
        setDirty(true);
        return;
      }

      if (draggingVertexIdx.current === null) return;
      const idx = draggingVertexIdx.current;
      setPolygon((prev) =>
        prev.map((p, i) => (i === idx ? [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))] : p))
      );
      setDirty(true);
      setUsedManualThisSession(true);
    },
    [editEnabled, editMode, getNormalized]
  );

  const onCanvasMouseUp = useCallback(() => {
    draggingVertexIdx.current = null;
    translateAnchor.current = null;
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
          previousMarkedImageDataUrl: previousMarkedImageDataUrl ?? null,
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

  function importPreviousPolygon() {
    if (!previousMarkedPolygon || previousMarkedPolygon.length < 3) return;
    setPolygon(previousMarkedPolygon);
    setDirty(true);
    setUsedManualThisSession(true);
    if (!editEnabled) setEditEnabled(true);
    setEditMode("translate"); // user almost certainly wants to drag-and-place after importing
  }

  async function save() {
    const markedDataUrl = polygon.length >= 3 ? await composeMarkedDataUrl(tile.rawDataUrl, polygon) : null;
    onSave({ ...tile, polygon, markedDataUrl, mark }, usedManualThisSession);
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

  const positionInNav = navigableIndices.indexOf(tile.pageIndex);
  const navTotal = navigableIndices.length;
  const isFirst = positionInNav <= 0;
  const isLast = positionInNav === -1 || positionInNav >= navTotal - 1;
  const displayPos = positionInNav >= 0 ? positionInNav + 1 : 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Page editor</div>
          <h2 className="text-lg font-semibold">
            Page {displayPos} of {navTotal}
            <span className="ml-2 text-[11px] font-normal text-muted">
              (PDF page {tile.pageIndex + 1} of {totalPages})
            </span>
            {dirty && <span className="ml-2 text-[11px] font-normal text-warn">· unsaved</span>}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(-1)}
            disabled={isFirst}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/30 disabled:opacity-40"
          >
            ◀ Prev
          </button>
          <button
            onClick={() => onNavigate(1)}
            disabled={isLast}
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

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_1fr_280px]">
        <div className="flex flex-col gap-3 overflow-auto">
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Map reference</div>
            {referenceImageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={referenceImageDataUrl}
                alt="Map reference sent to vision"
                className="mt-2 w-full rounded-lg border border-border"
              />
            ) : (
              <p className="mt-2 text-[11px] leading-5 text-muted">
                No reference image. Confirm a parcel back on the main page to enable shape matching.
              </p>
            )}
          </div>
          {previousMarkedImageDataUrl && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Prior confirmed page
                </div>
                {previousMarkedPolygon && previousMarkedPolygon.length >= 3 && (
                  <button
                    onClick={importPreviousPolygon}
                    className="text-[10px] font-medium text-brand underline-offset-2 hover:underline"
                    title="Copy the prior page's polygon onto this image so you can drag it into place"
                  >
                    ↗ Import polygon
                  </button>
                )}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previousMarkedImageDataUrl}
                alt="Last saved page used as a second reference"
                className="mt-2 w-full rounded-lg border border-border"
              />
              <p className="mt-2 text-[10px] leading-4 text-muted">
                Vision uses this as a style/example reference. Click "Import polygon" to start with
                the same shape and drag it into place.
              </p>
            </div>
          )}
        </div>

        <div className="relative flex items-center justify-center overflow-auto rounded-2xl border border-border bg-foreground/[0.04]">
          <canvas
            ref={canvasRef}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            className={`max-h-full max-w-full ${
              editEnabled ? (editMode === "translate" ? "cursor-move" : "cursor-crosshair") : "cursor-default"
            }`}
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

          {previousMarkedPolygon && previousMarkedPolygon.length >= 3 && (
            <button
              onClick={importPreviousPolygon}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:border-brand hover:text-brand"
              title="Copy previous polygon and switch to Translate mode so you can drag it into place"
            >
              ↗ Import previous polygon
            </button>
          )}

          <button
            onClick={() => setEditEnabled((v) => !v)}
            className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium ${
              editEnabled
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-background text-foreground hover:border-foreground/30"
            }`}
          >
            {editEnabled ? "✓ Manual edit on" : "✏ Manual edit"}
          </button>

          {editEnabled && (
            <>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Edit mode
                </div>
                <div className="mt-2 inline-flex w-full rounded-full border border-border bg-background p-0.5 text-[11px]">
                  <button
                    onClick={() => setEditMode("vertex")}
                    className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                      editMode === "vertex" ? "bg-brand text-white" : "text-muted hover:text-foreground"
                    }`}
                  >
                    ✚ Vertex
                  </button>
                  <button
                    onClick={() => setEditMode("translate")}
                    className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                      editMode === "translate" ? "bg-brand text-white" : "text-muted hover:text-foreground"
                    }`}
                  >
                    ↔ Translate
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted">
                  {editMode === "vertex" ? (
                    <>
                      <span className="font-medium text-foreground">Vertex mode:</span> click empty
                      space to add a vertex, drag a white dot to move it, shift-click a vertex to
                      delete it.
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">Translate mode:</span> click and
                      drag anywhere on the canvas to slide the whole polygon. Useful right after
                      "Import previous polygon".
                    </>
                  )}
                </p>
                {polygon.length > 0 && (
                  <button
                    onClick={() => {
                      setPolygon([]);
                      setDirty(true);
                      setUsedManualThisSession(true);
                    }}
                    className="mt-2 text-[11px] text-error underline-offset-2 hover:underline"
                  >
                    Clear polygon ({polygon.length} vertices)
                  </button>
                )}
              </div>
            </>
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
              <p className="mt-2 max-h-40 overflow-auto text-[11px] leading-5 text-muted">{tile.pageText}</p>
            </details>
          )}

          {err && (
            <div className="rounded-lg border border-error/40 bg-error/10 p-3 text-[11px] text-error">{err}</div>
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
              {dirty ? "Save & continue" : "No changes"}
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
  if (id.includes("sonnet")) return "Claude Sonnet 4.5";
  if (id.includes("haiku")) return "Claude Haiku 4.5";
  if (id.includes("gpt-5")) return "GPT-5";
  if (id.includes("gemini")) return "Gemini 2.5 Flash";
  return id;
}
