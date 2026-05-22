// Client-side PDF -> Canvas rasterization via pdfjs-dist.
// Lives in a "use client"-only component path. Never import this from a server route.

export type RenderedPage = {
  pageIndex: number; // 0-based
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

let workerConfigured = false;

async function configureWorker(): Promise<typeof import("pdfjs-dist")> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    // Option B from PLAN.md — unpkg CDN keyed to the installed version. Avoids
    // Turbopack/?url import complexity; works the same in dev and prod.
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    workerConfigured = true;
  }
  return pdfjs;
}

export async function* renderPdfToCanvases(
  file: File,
  opts: { dpi?: number } = {}
): AsyncGenerator<RenderedPage, void, unknown> {
  const dpi = Math.min(Math.max(opts.dpi ?? 96, 48), 200);
  const scale = dpi / 72; // pdf default is 72 DPI

  const pdfjs = await configureWorker();
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buf });
  const doc = await loadingTask.promise;

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2D canvas context");

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      page.cleanup();

      yield { pageIndex: i - 1, canvas, width: canvas.width, height: canvas.height };
    }
  } finally {
    await doc.destroy().catch(() => {});
  }
}

export async function getPageCount(file: File): Promise<number> {
  const pdfjs = await configureWorker();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const n = doc.numPages;
  await doc.destroy().catch(() => {});
  return n;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("canvas.toBlob returned null"));
    }, type);
  });
}
