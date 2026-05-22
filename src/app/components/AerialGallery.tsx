"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canvasToDataUrl } from "@/lib/canvas-mark";
import { extractAddressCandidates } from "@/lib/extract-addresses";
import { getPageCount, renderPdfToCanvases } from "@/lib/pdf-render";
import { DEFAULT_VISION_MODEL_ID } from "@/lib/vision-models";
import type { ParcelLookupResult } from "@/app/components/AddressInput";
import { VisionModelPicker } from "@/app/components/VisionModelPicker";
import { PageDetailEditor, type EditorTile } from "@/app/components/PageDetailEditor";

type Tile = {
  pageIndex: number;
  rawDataUrl: string | null;
  markedDataUrl: string | null;
  pageText: string;
  polygon: Array<[number, number]>;
  status: "pending" | "rendering" | "ready" | "marking" | "error";
  mark?: {
    visible: boolean;
    confidence: number;
    rationale: string;
    modelUsed: string;
  };
  error?: string;
};

export function AerialGallery({
  file,
  parcel,
  referenceImageDataUrl,
  baseFilename,
  onAddressCandidates,
}: {
  file: File | null;
  parcel: ParcelLookupResult | null;
  referenceImageDataUrl?: string | null;
  baseFilename?: string;
  onAddressCandidates?: (candidates: string[]) => void;
}) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [renderBusy, setRenderBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_VISION_MODEL_ID);

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Editor
  const [editorOpenIdx, setEditorOpenIdx] = useState<number | null>(null);
  const [navigableIndices, setNavigableIndices] = useState<number[]>([]);
  // Last saved marked image to feed forward into vision for the next page
  const [lastSavedRef, setLastSavedRef] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const tilesRef = useRef<Tile[]>([]);
  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  // Render pages
  useEffect(() => {
    cancelRef.current = false;
    setTiles([]);
    setErr(null);
    setEditorOpenIdx(null);
    setSelected(new Set());
    setSelectMode(false);
    setLastSavedRef(null);
    if (!file) return;
    setRenderBusy(true);

    (async () => {
      try {
        const count = await getPageCount(file);
        const initial: Tile[] = Array.from({ length: count }, (_, i) => ({
          pageIndex: i,
          rawDataUrl: null,
          markedDataUrl: null,
          pageText: "",
          polygon: [],
          status: "pending",
        }));
        setTiles(initial);

        for await (const page of renderPdfToCanvases(file, { dpi: 100 })) {
          if (cancelRef.current) return;
          const rawDataUrl = canvasToDataUrl(page.canvas);
          setTiles((prev) => {
            const next = [...prev];
            next[page.pageIndex] = {
              pageIndex: page.pageIndex,
              rawDataUrl,
              markedDataUrl: null,
              pageText: page.pageText,
              polygon: [],
              status: "ready",
            };
            return next;
          });
        }
      } catch (e) {
        if (!cancelRef.current) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelRef.current) setRenderBusy(false);
      }
    })();

    return () => {
      cancelRef.current = true;
    };
  }, [file]);

  // Address candidates
  const candidates = useMemo(() => {
    if (tiles.length === 0) return [];
    return extractAddressCandidates(tiles.map((t) => t.pageText));
  }, [tiles]);

  useEffect(() => {
    onAddressCandidates?.(candidates);
  }, [candidates, onAddressCandidates]);

  // Tile selection
  const toggleSelect = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const enterSelectMode = useCallback(() => setSelectMode(true), []);
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(tilesRef.current.filter((t) => t.rawDataUrl).map((t) => t.pageIndex)));
  }, []);

  const deleteSelected = useCallback(() => {
    if (selected.size === 0) return;
    setTiles((prev) => prev.filter((t) => !selected.has(t.pageIndex)));
    setSelected(new Set());
  }, [selected]);

  const downloadSelected = useCallback(async () => {
    if (selected.size === 0) return;
    const sortedIndices = [...selected].sort((a, b) => a - b);
    for (const idx of sortedIndices) {
      const tile = tilesRef.current.find((t) => t.pageIndex === idx);
      if (!tile) continue;
      const url = tile.markedDataUrl ?? tile.rawDataUrl;
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url;
      const base = (baseFilename ?? file?.name ?? "aerial").replace(/\.[^.]+$/, "");
      const tag = tile.markedDataUrl ? "marked" : "raw";
      a.download = `${base}-page-${String(idx + 1).padStart(2, "0")}-${tag}.png`;
      a.click();
      await new Promise((r) => setTimeout(r, 120));
    }
  }, [selected, baseFilename, file]);

  const downloadAll = useCallback(async () => {
    for (const tile of tilesRef.current) {
      const url = tile.markedDataUrl ?? tile.rawDataUrl;
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url;
      const base = (baseFilename ?? file?.name ?? "aerial").replace(/\.[^.]+$/, "");
      const tag = tile.markedDataUrl ? "marked" : "raw";
      a.download = `${base}-page-${String(tile.pageIndex + 1).padStart(2, "0")}-${tag}.png`;
      a.click();
      await new Promise((r) => setTimeout(r, 120));
    }
  }, [baseFilename, file]);

  const proceedToEditor = useCallback(() => {
    const indices = [...selected].sort((a, b) => a - b);
    if (indices.length === 0) return;
    setNavigableIndices(indices);
    setEditorOpenIdx(indices[0]);
  }, [selected]);

  const openEditorForTile = useCallback((idx: number) => {
    const t = tilesRef.current.find((x) => x.pageIndex === idx);
    if (!t?.rawDataUrl) return;
    // When opening from a single tile click, navigate through all rendered pages
    setNavigableIndices(tilesRef.current.filter((x) => x.rawDataUrl).map((x) => x.pageIndex));
    setEditorOpenIdx(idx);
  }, []);

  const navigateEditor = useCallback((direction: -1 | 1) => {
    setEditorOpenIdx((current) => {
      if (current === null) return null;
      const order = navigableIndices;
      const pos = order.indexOf(current);
      if (pos < 0) return current;
      const nextPos = pos + direction;
      if (nextPos < 0 || nextPos >= order.length) return current;
      return order[nextPos];
    });
  }, [navigableIndices]);

  const saveFromEditor = useCallback((updated: EditorTile, wasManual: boolean) => {
    setTiles((prev) => {
      const next = [...prev];
      const idx = next.findIndex((t) => t.pageIndex === updated.pageIndex);
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          polygon: updated.polygon,
          markedDataUrl: updated.markedDataUrl,
          mark: updated.mark,
          status: "ready",
        };
      }
      return next;
    });
    // Feed forward: any saved marked image becomes the new "prior confirmed" reference.
    // Manual saves are the most reliable; vision-only saves are still useful as style refs.
    if (updated.markedDataUrl) {
      void wasManual; // currently every save is treated equivalently — keep flag for future weighting
      setLastSavedRef(updated.markedDataUrl);
    }
  }, []);

  if (!file) return null;

  const ready = tiles.filter((t) => t.rawDataUrl).length;
  const markedCount = tiles.filter((t) => t.markedDataUrl).length;
  const total = tiles.length;
  const selectedCount = selected.size;

  const editorTile: EditorTile | null = (() => {
    if (editorOpenIdx === null) return null;
    const t = tiles.find((x) => x.pageIndex === editorOpenIdx);
    if (!t?.rawDataUrl) return null;
    return {
      pageIndex: t.pageIndex,
      rawDataUrl: t.rawDataUrl,
      markedDataUrl: t.markedDataUrl,
      pageText: t.pageText,
      polygon: t.polygon,
      mark: t.mark,
    };
  })();

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Aerial timeline</div>
          <div className="mt-1 text-sm">
            {renderBusy ? (
              <span className="text-muted">
                Rendering pages in browser… {ready}/{total || "?"}
              </span>
            ) : err ? (
              <span className="text-error">Error: {err}</span>
            ) : total > 0 ? (
              <span>
                {total} page{total === 1 ? "" : "s"} rendered
                {markedCount > 0 && <span className="ml-2 text-muted">· {markedCount} saved</span>}
              </span>
            ) : (
              <span className="text-muted">Waiting for PDF…</span>
            )}
          </div>
          {!parcel && tiles.length > 0 && (
            <p className="mt-1 text-[11px] text-warn">
              Look up a property in section 1 first — the marker needs the parcel polygon.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VisionModelPicker value={model} onChange={setModel} disabled={renderBusy} compact />
          {!selectMode ? (
            <>
              <button
                onClick={enterSelectMode}
                disabled={renderBusy || total === 0}
                className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-xs font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                title="Pick which pages to keep / process; remove cover and index pages"
              >
                ☑ Select images
              </button>
              <button
                onClick={downloadAll}
                disabled={renderBusy || total === 0}
                className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-xs font-medium hover:border-foreground/30 disabled:opacity-60"
              >
                Download all PNGs
              </button>
            </>
          ) : (
            <button
              onClick={exitSelectMode}
              className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-xs font-medium hover:border-foreground/30"
            >
              ✕ Exit select
            </button>
          )}
        </div>
      </div>

      {selectMode && (
        <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="font-semibold">
              {selectedCount} selected
              {total > 0 && <span className="ml-1 text-muted">of {total}</span>}
            </span>
            <button
              onClick={selectAll}
              className="text-xs text-brand underline-offset-2 hover:underline"
            >
              Select all
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={selectedCount === 0}
              className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={deleteSelected}
              disabled={selectedCount === 0}
              className="inline-flex h-8 items-center rounded-full border border-error/50 bg-background px-3 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-40"
            >
              🗑 Delete selected
            </button>
            <button
              onClick={downloadSelected}
              disabled={selectedCount === 0}
              className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-medium hover:border-foreground/30 disabled:opacity-40"
            >
              ↓ Download selected
            </button>
            <button
              onClick={proceedToEditor}
              disabled={selectedCount === 0 || !parcel}
              className="inline-flex h-8 items-center rounded-full bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              title={!parcel ? "Confirm a property first" : "Open the page editor on the selected pages"}
            >
              Proceed to editor →
            </button>
          </div>
        </div>
      )}

      {tiles.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted">
          {renderBusy ? "Reading PDF…" : "—"}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {tiles.map((tile) => (
            <TileView
              key={tile.pageIndex}
              tile={tile}
              selectMode={selectMode}
              selected={selected.has(tile.pageIndex)}
              onToggleSelect={() => toggleSelect(tile.pageIndex)}
              onOpen={() => openEditorForTile(tile.pageIndex)}
            />
          ))}
        </div>
      )}

      {editorTile && parcel && (
        <PageDetailEditor
          tile={editorTile}
          totalPages={tiles.length}
          navigableIndices={navigableIndices.length > 0 ? navigableIndices : tiles.filter((t) => t.rawDataUrl).map((t) => t.pageIndex)}
          parcel={parcel}
          referenceImageDataUrl={referenceImageDataUrl ?? null}
          previousMarkedImageDataUrl={lastSavedRef}
          defaultModel={model}
          baseFilename={baseFilename}
          onSave={saveFromEditor}
          onClose={() => setEditorOpenIdx(null)}
          onNavigate={navigateEditor}
        />
      )}
    </div>
  );
}

function TileView({
  tile,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
}: {
  tile: Tile;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const displayUrl = tile.markedDataUrl ?? tile.rawDataUrl;
  const mark = tile.mark;
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-background transition-colors ${
        selectMode && selected
          ? "border-brand ring-2 ring-brand/40"
          : "border-border hover:border-foreground/30"
      }`}
    >
      <button
        type="button"
        onClick={selectMode ? onToggleSelect : onOpen}
        disabled={!displayUrl}
        className="block w-full text-left disabled:cursor-default"
        title={selectMode ? (selected ? "Deselect" : "Select") : "Open page editor"}
      >
        <div className="relative aspect-[4/3] w-full bg-foreground/[0.04]">
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={`Aerial page ${tile.pageIndex + 1}`}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              {tile.status === "pending" ? "queued" : "rendering…"}
            </div>
          )}
          {selectMode && (
            <div
              className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 text-xs font-bold shadow ${
                selected ? "border-brand bg-brand text-white" : "border-border bg-background/90 text-transparent"
              }`}
              aria-hidden
            >
              ✓
            </div>
          )}
          {mark && !selectMode && (
            <div className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold shadow">
              {mark.visible ? (
                <span className="text-brand">boundary · {(mark.confidence * 100).toFixed(0)}%</span>
              ) : (
                <span className="text-muted">no map</span>
              )}
            </div>
          )}
        </div>
      </button>
      <div className="px-3 pb-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Page {tile.pageIndex + 1}</span>
          {!selectMode && (
            <button
              onClick={onOpen}
              disabled={!displayUrl}
              className="text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
            >
              Open editor →
            </button>
          )}
        </div>
        {tile.pageText && (
          <div className="mt-1 line-clamp-1 text-[10px] text-muted" title={tile.pageText}>
            📄 {tile.pageText.slice(0, 120)}
          </div>
        )}
        {mark?.rationale && (
          <div className="mt-1 line-clamp-2 text-[10px] text-muted" title={mark.rationale}>
            {mark.rationale}
          </div>
        )}
        {tile.error && <div className="mt-1 text-[10px] text-error">{tile.error}</div>}
      </div>
    </div>
  );
}
