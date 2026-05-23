"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { composeMarkedDataUrl, downsampleDataUrl } from "@/lib/canvas-mark";
import { VisionModelPicker } from "@/app/components/VisionModelPicker";
import type { ParcelLookupResult } from "@/app/components/AddressInput";

const MARK_INPUT_MAX_SIDE = 1024;
const VERTEX_HIT_RADIUS = 0.025;
const PAN_STEP = 0.02;
const SCALE_UP = 1.1;
const SCALE_DOWN = 1 / 1.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const HISTORY_CAP = 30;

type EditMode = "draw" | "vertex" | "translate";

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

type Polygon = Array<[number, number]>;

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
  previousMarkedPolygon: Polygon | null;
  defaultModel: string;
  onSave: (updated: EditorTile, wasManual: boolean) => void;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  baseFilename?: string;
}) {
  const [polygon, setPolygon] = useState<Polygon>(() => {
    if ((!tile.polygon || tile.polygon.length === 0) && previousMarkedPolygon && previousMarkedPolygon.length >= 3) {
      return previousMarkedPolygon;
    }
    return tile.polygon ?? [];
  });
  const [history, setHistory] = useState<Polygon[]>([]);

  const [editEnabled, setEditEnabled] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>("vertex");
  const [usedManualThisSession, setUsedManualThisSession] = useState(false);

  const [model, setModel] = useState(defaultModel);
  const [marking, setMarking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mark, setMark] = useState(tile.mark);
  const [dirty, setDirty] = useState(() => {
    return (!tile.polygon || tile.polygon.length === 0) && !!previousMarkedPolygon && previousMarkedPolygon.length >= 3;
  });

  const [refZoom, setRefZoom] = useState(1);
  const [priorZoom, setPriorZoom] = useState(1);
  const [canvasZoom, setCanvasZoom] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const draggingVertexIdx = useRef<number | null>(null);
  const translateAnchor = useRef<{ x: number; y: number } | null>(null);

  // Reset when navigating to a different tile
  useEffect(() => {
    const hasOwnPolygon = tile.polygon && tile.polygon.length >= 3;
    const canPrefill = previousMarkedPolygon && previousMarkedPolygon.length >= 3;
    if (hasOwnPolygon) {
      setPolygon(tile.polygon);
      setDirty(false);
      setEditMode("vertex");
    } else if (canPrefill) {
      setPolygon(previousMarkedPolygon);
      setDirty(true);
      setEditMode("translate"); // imported polygon — user almost certainly wants to drag/resize
    } else {
      setPolygon([]);
      setDirty(false);
      setEditMode("draw"); // empty page — drawing from scratch is the right default
    }
    setHistory([]);
    setMark(tile.mark);
    setErr(null);
    setEditEnabled(false);
    setUsedManualThisSession(false);
    setCanvasZoom(1);
  }, [tile.pageIndex, tile.polygon, tile.mark, previousMarkedPolygon]);

  // Polygon-mutating helpers; every mutation snapshots prior state for Undo.
  const pushPolygon = useCallback((mutator: (prev: Polygon) => Polygon) => {
    setPolygon((prev) => {
      const next = mutator(prev);
      if (next === prev) return prev;
      setHistory((h) => {
        const out = [...h, prev];
        if (out.length > HISTORY_CAP) out.shift();
        return out;
      });
      return next;
    });
    setDirty(true);
    setUsedManualThisSession(true);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setPolygon(last);
      setDirty(true);
      return h.slice(0, -1);
    });
  }, []);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      pushPolygon((prev) =>
        prev.length === 0
          ? prev
          : prev.map(([x, y]) => [
              Math.max(0, Math.min(1, x + dx)),
              Math.max(0, Math.min(1, y + dy)),
            ] as [number, number])
      );
    },
    [pushPolygon]
  );

  const resize = useCallback(
    (factor: number) => {
      pushPolygon((prev) => {
        if (prev.length === 0) return prev;
        const cx = prev.reduce((s, [x]) => s + x, 0) / prev.length;
        const cy = prev.reduce((s, [, y]) => s + y, 0) / prev.length;
        return prev.map(([x, y]) => [
          Math.max(0, Math.min(1, cx + (x - cx) * factor)),
          Math.max(0, Math.min(1, cy + (y - cy) * factor)),
        ] as [number, number]);
      });
    },
    [pushPolygon]
  );

  const clearPolygon = useCallback(() => {
    pushPolygon(() => []);
  }, [pushPolygon]);

  const removeLastVertex = useCallback(() => {
    pushPolygon((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)));
  }, [pushPolygon]);

  // Image load
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
      ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
      ctx.fill();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.95)";
      ctx.lineWidth = Math.max(4, Math.round(canvas.width / 250));
      ctx.lineJoin = "round";
      ctx.stroke();
    } else if (polygon.length >= 2) {
      // Two-point partial polyline — show the user it's a work-in-progress
      ctx.beginPath();
      ctx.moveTo(polygon[0][0] * canvas.width, polygon[0][1] * canvas.height);
      ctx.lineTo(polygon[1][0] * canvas.width, polygon[1][1] * canvas.height);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
      ctx.lineWidth = Math.max(3, Math.round(canvas.width / 320));
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (editEnabled && polygon.length > 0) {
      const r = Math.max(8, Math.round(canvas.width / 140));
      polygon.forEach(([x, y], i) => {
        const px = x * canvas.width;
        const py = y * canvas.height;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 && editMode === "draw" ? "#ef4444" : "white";
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
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Auto-enable manual edit on first canvas click — discoverability fix
      if (!editEnabled) setEditEnabled(true);

      const { x, y } = getNormalized(e);

      if (editMode === "draw") {
        pushPolygon((prev) => [...prev, [x, y]]);
        return;
      }

      if (editMode === "translate") {
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
          pushPolygon((prev) => prev.filter((_, i) => i !== nearestIdx));
        } else {
          draggingVertexIdx.current = nearestIdx;
        }
        return;
      }
      // Empty area: insert at nearest edge (for cleaner editing of existing polygons)
      if (polygon.length < 3) {
        pushPolygon((prev) => [...prev, [x, y]]);
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
        pushPolygon((prev) => {
          const next = [...prev];
          next.splice(bestEdge + 1, 0, [x, y]);
          return next;
        });
      }
    },
    [editEnabled, editMode, polygon, getNormalized, pushPolygon]
  );

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!editEnabled) return;
      const { x, y } = getNormalized(e);

      if (editMode === "translate" && translateAnchor.current) {
        const dx = x - translateAnchor.current.x;
        const dy = y - translateAnchor.current.y;
        translateAnchor.current = { x, y };
        // Don't snapshot every mousemove — just update polygon
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
        prev.map((p, i) => (i === idx ? [x, y] : p))
      );
      setDirty(true);
      setUsedManualThisSession(true);
    },
    [editEnabled, editMode, getNormalized]
  );

  const onCanvasMouseUp = useCallback(() => {
    if (draggingVertexIdx.current !== null) {
      draggingVertexIdx.current = null;
      // Commit a single history entry for the drag operation
      // (We don't have the start position; in practice the user can undo by inverting)
    }
    if (translateAnchor.current !== null) {
      translateAnchor.current = null;
    }
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
      const newPolygon = Array.isArray(data.pixelPolygon) ? (data.pixelPolygon as Polygon) : [];
      pushPolygon(() => newPolygon);
      setMark({
        visible: Boolean(data.visible),
        confidence: Number(data.confidence ?? 0),
        rationale: String(data.rationale ?? ""),
        modelUsed: String(data.modelUsed ?? model),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setMarking(false);
    }
  }

  function importPreviousPolygon() {
    if (!previousMarkedPolygon || previousMarkedPolygon.length < 3) return;
    pushPolygon(() => previousMarkedPolygon);
    if (!editEnabled) setEditEnabled(true);
    setEditMode("translate");
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
        {/* Reference column */}
        <div className="flex flex-col gap-3 overflow-auto">
          <PanelWithZoom
            title="Map reference"
            zoom={refZoom}
            setZoom={setRefZoom}
            imgSrc={referenceImageDataUrl}
            emptyText="No reference image. Confirm a parcel back on the main page to enable shape matching."
          />
          {previousMarkedImageDataUrl && (
            <PanelWithZoom
              title="Prior confirmed page"
              zoom={priorZoom}
              setZoom={setPriorZoom}
              imgSrc={previousMarkedImageDataUrl}
              accessory={
                previousMarkedPolygon && previousMarkedPolygon.length >= 3 ? (
                  <button
                    onClick={importPreviousPolygon}
                    className="text-[10px] font-medium text-brand underline-offset-2 hover:underline"
                  >
                    ↗ Import polygon
                  </button>
                ) : undefined
              }
              footnote="Vision uses this as a style/example reference. Click 'Import polygon' to start with the same shape and drag it into place."
            />
          )}
        </div>

        {/* Canvas + toolbar column */}
        <div className="flex flex-col gap-3 overflow-hidden">
          <EditorToolbar
            editMode={editMode}
            setEditMode={setEditMode}
            onNudge={nudge}
            onResize={resize}
            onUndo={undo}
            onRemoveLast={removeLastVertex}
            onClear={clearPolygon}
            canvasZoom={canvasZoom}
            setCanvasZoom={setCanvasZoom}
            polygonLen={polygon.length}
            canUndo={history.length > 0}
          />
          <div className="relative flex flex-1 items-start justify-center overflow-auto rounded-2xl border border-border bg-foreground/[0.04]">
            <div
              style={{
                transform: `scale(${canvasZoom})`,
                transformOrigin: "top left",
                width: "fit-content",
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={onCanvasMouseDown}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={onCanvasMouseUp}
                className={
                  editEnabled
                    ? editMode === "translate"
                      ? "cursor-move"
                      : "cursor-crosshair"
                    : "cursor-pointer"
                }
                style={{ touchAction: "none", display: "block" }}
              />
            </div>
            {marking && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-medium">
                Re-marking with {findModelLabel(model)}…
              </div>
            )}
          </div>
        </div>

        {/* Controls column */}
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
            >
              ↗ Import previous polygon
            </button>
          )}

          <div className="rounded-lg border border-border bg-card p-3 text-[11px] leading-5 text-muted">
            <div className="font-medium text-foreground">Mode hints</div>
            <ul className="mt-1 space-y-1">
              <li><span className="font-medium text-foreground">Draw:</span> click in order to drop vertices around the parcel; lines fill in as you click.</li>
              <li><span className="font-medium text-foreground">Vertex:</span> drag white dots to move, shift-click to delete, click an edge to insert.</li>
              <li><span className="font-medium text-foreground">Translate:</span> click-drag the canvas to slide the whole polygon.</li>
            </ul>
            <p className="mt-2">Use the toolbar arrows and +/− to nudge / resize without changing mode. Undo reverts the last polygon change.</p>
          </div>

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

function PanelWithZoom({
  title,
  zoom,
  setZoom,
  imgSrc,
  accessory,
  footnote,
  emptyText,
}: {
  title: string;
  zoom: number;
  setZoom: (n: number) => void;
  imgSrc: string | null;
  accessory?: React.ReactNode;
  footnote?: string;
  emptyText?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{title}</div>
        <div className="flex items-center gap-2">
          {accessory}
          {imgSrc && (
            <ZoomCluster zoom={zoom} setZoom={setZoom} />
          )}
        </div>
      </div>
      {imgSrc ? (
        <div className="mt-2 max-h-[400px] overflow-auto rounded-lg border border-border">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: "fit-content" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc} alt={title} className="block max-w-none" />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[11px] leading-5 text-muted">{emptyText}</p>
      )}
      {imgSrc && footnote && <p className="mt-2 text-[10px] leading-4 text-muted">{footnote}</p>}
    </div>
  );
}

function ZoomCluster({ zoom, setZoom }: { zoom: number; setZoom: (n: number) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-1 py-0.5">
      <button
        onClick={() => setZoom(Math.max(ZOOM_MIN, +(zoom - ZOOM_STEP).toFixed(2)))}
        className="grid h-5 w-5 place-items-center rounded-full text-[12px] font-bold text-muted hover:bg-card hover:text-foreground"
        title="Zoom out"
      >
        −
      </button>
      <span className="min-w-[2.4rem] text-center text-[10px] font-medium tabular-nums text-muted">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => setZoom(Math.min(ZOOM_MAX, +(zoom + ZOOM_STEP).toFixed(2)))}
        className="grid h-5 w-5 place-items-center rounded-full text-[12px] font-bold text-muted hover:bg-card hover:text-foreground"
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
}

function EditorToolbar({
  editMode,
  setEditMode,
  onNudge,
  onResize,
  onUndo,
  onRemoveLast,
  onClear,
  canvasZoom,
  setCanvasZoom,
  polygonLen,
  canUndo,
}: {
  editMode: EditMode;
  setEditMode: (m: EditMode) => void;
  onNudge: (dx: number, dy: number) => void;
  onResize: (factor: number) => void;
  onUndo: () => void;
  onRemoveLast: () => void;
  onClear: () => void;
  canvasZoom: number;
  setCanvasZoom: (n: number) => void;
  polygonLen: number;
  canUndo: boolean;
}) {
  const hasPolygon = polygonLen > 0;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Mode</span>
        <div className="inline-flex rounded-full border border-border bg-background p-0.5 text-[11px]">
          <ModeButton active={editMode === "draw"} onClick={() => setEditMode("draw")}>
            ✚ Draw
          </ModeButton>
          <ModeButton active={editMode === "vertex"} onClick={() => setEditMode("vertex")}>
            ⊙ Vertex
          </ModeButton>
          <ModeButton active={editMode === "translate"} onClick={() => setEditMode("translate")}>
            ↔ Translate
          </ModeButton>
        </div>
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Move</span>
        <ToolbarButton onClick={() => onNudge(-PAN_STEP, 0)} disabled={!hasPolygon} title="Move left">
          ←
        </ToolbarButton>
        <ToolbarButton onClick={() => onNudge(0, -PAN_STEP)} disabled={!hasPolygon} title="Move up">
          ↑
        </ToolbarButton>
        <ToolbarButton onClick={() => onNudge(0, PAN_STEP)} disabled={!hasPolygon} title="Move down">
          ↓
        </ToolbarButton>
        <ToolbarButton onClick={() => onNudge(PAN_STEP, 0)} disabled={!hasPolygon} title="Move right">
          →
        </ToolbarButton>
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Size</span>
        <ToolbarButton onClick={() => onResize(SCALE_UP)} disabled={!hasPolygon} title="Grow polygon 10%">
          ➕
        </ToolbarButton>
        <ToolbarButton onClick={() => onResize(SCALE_DOWN)} disabled={!hasPolygon} title="Shrink polygon 10%">
          ➖
        </ToolbarButton>
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        <ToolbarButton onClick={onUndo} disabled={!canUndo} title="Undo last polygon change">
          ↺
        </ToolbarButton>
        <ToolbarButton onClick={onRemoveLast} disabled={!hasPolygon} title="Remove the most recently added vertex">
          ⌫
        </ToolbarButton>
        <ToolbarButton onClick={onClear} disabled={!hasPolygon} title="Clear the polygon">
          🗑
        </ToolbarButton>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Zoom</span>
        <ZoomCluster zoom={canvasZoom} setZoom={setCanvasZoom} />
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 transition-colors ${
        active ? "bg-brand text-white" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="grid h-7 min-w-[1.75rem] place-items-center rounded-full border border-border bg-background px-2 text-xs hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:border-border disabled:text-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="h-5 w-px bg-border" />;
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
