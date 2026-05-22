"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canvasToBlob, getPageCount, renderPdfToCanvases } from "@/lib/pdf-render";

type Tile = {
  pageIndex: number;
  dataUrl: string | null;
  width: number;
  height: number;
  status: "pending" | "rendering" | "ready" | "error";
  error?: string;
};

export function AerialGallery({
  file,
  baseFilename,
}: {
  file: File | null;
  baseFilename?: string;
}) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    setTiles([]);
    setErr(null);
    if (!file) return;
    setBusy(true);

    (async () => {
      try {
        const count = await getPageCount(file);
        setTiles(
          Array.from({ length: count }, (_, i) => ({
            pageIndex: i,
            dataUrl: null,
            width: 0,
            height: 0,
            status: "pending" as const,
          }))
        );

        for await (const page of renderPdfToCanvases(file, { dpi: 100 })) {
          if (cancelRef.current) return;
          const dataUrl = page.canvas.toDataURL("image/png");
          setTiles((prev) => {
            const next = [...prev];
            next[page.pageIndex] = {
              pageIndex: page.pageIndex,
              dataUrl,
              width: page.width,
              height: page.height,
              status: "ready",
            };
            return next;
          });
        }
      } catch (e) {
        if (!cancelRef.current) {
          setErr(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelRef.current) setBusy(false);
      }
    })();

    return () => {
      cancelRef.current = true;
    };
  }, [file]);

  const downloadTile = useCallback(
    async (tile: Tile) => {
      if (!tile.dataUrl) return;
      // dataUrl path is the simplest cross-browser download
      const a = document.createElement("a");
      a.href = tile.dataUrl;
      const base = (baseFilename ?? file?.name ?? "aerial").replace(/\.[^.]+$/, "");
      a.download = `${base}-page-${String(tile.pageIndex + 1).padStart(2, "0")}.png`;
      a.click();
    },
    [baseFilename, file]
  );

  const downloadAll = useCallback(async () => {
    for (const tile of tiles) {
      if (tile.dataUrl) {
        await downloadTile(tile);
        // small gap so browsers don't dedupe the downloads
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  }, [tiles, downloadTile]);

  if (!file) return null;

  const ready = tiles.filter((t) => t.status === "ready").length;
  const total = tiles.length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            Aerial timeline
          </div>
          <div className="mt-1 text-sm">
            {busy ? (
              <span className="text-muted">
                Rendering pages in browser… {ready}/{total || "?"}
              </span>
            ) : err ? (
              <span className="text-error">Error: {err}</span>
            ) : total > 0 ? (
              <span>{total} page{total === 1 ? "" : "s"} rendered locally</span>
            ) : (
              <span className="text-muted">Waiting for PDF…</span>
            )}
          </div>
        </div>
        {tiles.length > 0 && (
          <button
            onClick={downloadAll}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-xs font-medium hover:border-foreground/30 disabled:opacity-60"
          >
            Download all PNGs
          </button>
        )}
      </div>

      {tiles.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted">
          {busy ? "Reading PDF…" : "—"}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {tiles.map((tile) => (
            <Tile key={tile.pageIndex} tile={tile} onDownload={() => downloadTile(tile)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ tile, onDownload }: { tile: Tile; onDownload: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="aspect-[4/3] w-full bg-foreground/[0.04]">
        {tile.dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tile.dataUrl}
            alt={`Aerial page ${tile.pageIndex + 1}`}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            {tile.status === "pending" ? "queued" : "rendering…"}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium">Page {tile.pageIndex + 1}</span>
        <button
          onClick={onDownload}
          disabled={!tile.dataUrl}
          className="text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
        >
          Download PNG
        </button>
      </div>
    </div>
  );
}
