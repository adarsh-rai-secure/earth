// Client-side canvas helpers for compositing the parcel polygon onto an aerial PNG.

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

export async function downsampleDataUrl(
  dataUrl: string,
  maxSide: number,
  quality = 0.85
): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale >= 1) return dataUrl;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d ctx");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function composeMarkedDataUrl(
  rawDataUrl: string,
  pixelPolygon: Array<[number, number]>
): Promise<string> {
  const img = await loadImage(rawDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d ctx");
  ctx.drawImage(img, 0, 0);

  if (pixelPolygon.length >= 3) {
    ctx.beginPath();
    const [fx, fy] = pixelPolygon[0];
    ctx.moveTo(fx * canvas.width, fy * canvas.height);
    for (let i = 1; i < pixelPolygon.length; i++) {
      const [x, y] = pixelPolygon[i];
      ctx.lineTo(x * canvas.width, y * canvas.height);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
    ctx.fill();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.95)";
    ctx.lineWidth = Math.max(3, Math.round(canvas.width / 250));
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}
