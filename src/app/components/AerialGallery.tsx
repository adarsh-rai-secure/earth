"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canvasToDataUrl, composeMarkedDataUrl, downsampleDataUrl } from "@/lib/canvas-mark";
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

const MARK_CONCURRENCY = 4;
const MARK_INPUT_MAX_SIDE = 1024;

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
  const [markBusy, setMarkBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_VISION_MODEL_ID);
  const [editorOpenIdx, setEditorOpenIdx] = useState<number | null>(null);
  const cancelRef = useRef(false);

  const tilesRef = useRef<Tile[]>([]);
  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  useEffect(() => {
    cancelRef.current = false;
    setTiles([]);
    setErr(null);
    setEditorOpenIdx(null);
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

  const candidates = useMemo(() => {
    if (tiles.length === 0) return [];
    return extractAddressCandidates(tiles.map((t) => t.pageText));
  }, [tiles]);

  useEffect(() => {
    onAddressCandidates?.(candidates);
  }, [candidates, onAddressCandidates]);

  const markOne = useCallback(
    async (idx: number) => {
      if (!parcel) return;
      const current = tilesRef.current[idx];
      if (!current?.rawDataUrl) {
        setTiles((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx], status: "error", error: "Page not yet rendered" };
          return next;
        });
        return;
      }
      const raw = current.rawDataUrl;

      setTiles((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx], status: "marking", error: undefined };
        return next;
      });

      try {
        const downsampled = await downsampleDataUrl(raw, MARK_INPUT_MAX_SIDE, 0.85);
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

        const polygon =
          Array.isArray(data.pixelPolygon) && data.pixelPolygon.length >= 3
            ? (data.pixelPolygon as Array<[number, number]>)
            : [];
        const markedDataUrl =
          data.visible && polygon.length >= 3 ? await composeMarkedDataUrl(raw, polygon) : null;

        setTiles((prev) => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = {
              ...next[idx],
              markedDataUrl,
              polygon,
              status: "ready",
              mark: {
                visible: Boolean(data.visible),
                confidence: Number(data.confidence ?? 0),
                rationale: String(data.rationale ?? ""),
                modelUsed: String(data.modelUsed ?? model),
              },
            };
          }
          return next;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setTiles((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx], status: "error", error: msg };
          return next;
        });
      }
    },
    [parcel, referenceImageDataUrl, model]
  );

  const markAll = useCallback(async () => {
    if (!parcel || markBusy) return;
    setMarkBusy(true);
    setErr(null);
    try {
      const indices = tilesRef.current
        .map((t, i) => (t.rawDataUrl && t.status === "ready" ? i : -1))
        .filter((i) => i >= 0);

      const queue = [...indices];
      const workers = Array.from({ length: MARK_CONCURRENCY }, async () => {
        while (queue.length > 0) {
          const i = queue.shift();
          if (i === undefined) break;
          await markOne(i);
        }
      });
      await Promise.all(workers);
    } finally {
      setMarkBusy(false);
    }
  }, [parcel, markBusy, markOne]);

  const downloadTile = useCallback(
    (tile: Tile) => {
      const url = tile.markedDataUrl ?? tile.rawDataUrl;
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      const base = (baseFilename ?? file?.name ?? "aerial").replace(/\.[^.]+$/, "");
      const tag = tile.markedDataUrl ? "marked" : "raw";
      a.download = `${base}-page-${String(tile.pageIndex + 1).padStart(2, "0")}-${tag}.png`;
      a.click();
    },
    [baseFilename, file]
  );

  const downloadAll = useCallback(async () => {
    for (const tile of tiles) {
      if (tile.rawDataUrl || tile.markedDataUrl) {
        downloadTile(tile);
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  }, [tiles, downloadTile]);

  const openEditor = useCallback((idx: number) => {
    const t = tilesRef.current[idx];
    if (!t?.rawDataUrl) return;
    setEditorOpenIdx(idx);
  }, []);

  const navigateEditor = useCallback((direction: -1 | 1) => {
    setEditorOpenIdx((current) => {
      if (current === null) return null;
      const total = tilesRef.current.length;
      let next = current + direction;
      // skip pages without a rendered image
      while (next >= 0 && next < total && !tilesRef.current[next]?.rawDataUrl) {
        next += direction;
      }
      if (next < 0 || next >= total) return current;
      return next;
    });
  }, []);

  const saveFromEditor = useCallback((updated: EditorTile) => {
    setTiles((prev) => {
      const next = [...prev];
      const idx = updated.pageIndex;
      if (next[idx]) {
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
  }, []);

  if (!file) return null;

  const ready = tiles.filter((t) => t.rawDataUrl).length;
  const markedCount = tiles.filter((t) => t.markedDataUrl).length;
  const noMapCount = tiles.filter((t) => t.mark && !t.mark.visible).length;
  const total = tiles.length;
  const canMark = !!parcel && ready > 0 && !markBusy && !renderBusy;

  const editorTile: EditorTile | null =
    editorOpenIdx !== null && tiles[editorOpenIdx]?.rawDataUrl
      ? {
          pageIndex: tiles[editorOpenIdx].pageIndex,
          rawDataUrl: tiles[editorOpenIdx].rawDataUrl!,
          markedDataUrl: tiles[editorOpenIdx].markedDataUrl,
          pageText: tiles[editorOpenIdx].pageText,
          polygon: tiles[editorOpenIdx].polygon,
          mark: tiles[editorOpenIdx].mark,
        }
      : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            Aerial timeline
          </div>
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
                {markedCount > 0 && (
                  <span className="ml-2 text-muted">
                    · {markedCount} with boundary
                    {noMapCount > 0 && ` · ${noMapCount} no map`}
                  </span>
                )}
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
          <VisionModelPicker value={model} onChange={setModel} disabled={markBusy} compact />
          <button
            onClick={markAll}
            disabled={!canMark}
            className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-xs font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            title={!parcel ? "Select a property first" : "Sends each page to the selected vision model"}
          >
            {markBusy ? `Marking… ${markedCount}/${total}` : `Mark all ${total} pages`}
          </button>
          <button
            onClick={downloadAll}
            disabled={renderBusy || total === 0}
            className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-xs font-medium hover:border-foreground/30 disabled:opacity-60"
          >
            Download all PNGs
          </button>
        </div>
      </div>

      {tiles.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted">
          {renderBusy ? "Reading PDF…" : "—"}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {tiles.map((tile, i) => (
            <TileView
              key={tile.pageIndex}
              tile={tile}
              onDownload={() => downloadTile(tile)}
              onMark={() => markOne(i)}
              onOpen={() => openEditor(i)}
              canMark={!!parcel && tile.status !== "marking" && !!tile.rawDataUrl}
            />
          ))}
        </div>
      )}

      {editorTile && parcel && (
        <PageDetailEditor
          tile={editorTile}
          totalPages={tiles.length}
          parcel={parcel}
          referenceImageDataUrl={referenceImageDataUrl ?? null}
          defaultModel={model}
          baseFilename={baseFilename}
          onSave={(updated) => {
            saveFromEditor(updated);
          }}
          onClose={() => setEditorOpenIdx(null)}
          onNavigate={navigateEditor}
        />
      )}
    </div>
  );
}

function TileView({
  tile,
  onDownload,
  onMark,
  onOpen,
  canMark,
}: {
  tile: Tile;
  onDownload: () => void;
  onMark: () => void;
  onOpen: () => void;
  canMark: boolean;
}) {
  const displayUrl = tile.markedDataUrl ?? tile.rawDataUrl;
  const mark = tile.mark;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-foreground/30">
      <button
        type="button"
        onClick={onOpen}
        disabled={!displayUrl}
        className="block w-full text-left disabled:cursor-default"
        title={displayUrl ? "Open page editor" : "Page not rendered yet"}
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
          {tile.status === "marking" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs text-foreground">
              marking…
            </div>
          )}
          {mark && (
            <div className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold shadow">
              {mark.visible ? (
                <span className="text-brand">boundary · {(mark.confidence * 100).toFixed(0)}%</span>
              ) : (
                <span className="text-muted">no map</span>
              )}
            </div>
          )}
          {displayUrl && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-foreground/40 to-transparent pb-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
              <span className="rounded-full bg-background/90 px-3 py-0.5 text-[10px] font-medium shadow">
                Open editor →
              </span>
            </div>
          )}
        </div>
      </button>
      <div className="px-3 pb-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Page {tile.pageIndex + 1}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onMark}
              disabled={!canMark}
              className="text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
            >
              {tile.markedDataUrl ? "Re-mark" : mark && !mark.visible ? "Re-check" : "Mark"}
            </button>
            <button
              onClick={onDownload}
              disabled={!displayUrl}
              className="text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
            >
              Download
            </button>
          </div>
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
