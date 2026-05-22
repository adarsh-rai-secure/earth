// Server-side static map renderer: tile fetch + sharp composite + polygon overlay.

import sharp from "sharp";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { TILE_SOURCES, tileUrl, type TileType } from "@/lib/map-tiles";

const TILE_SIZE = 256;

function lng2x(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z);
}

function lat2y(lat: number, z: number): number {
  return (
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
    Math.pow(2, z)
  );
}

function flattenRings(geom: Polygon | MultiPolygon): Position[][] {
  if (geom.type === "Polygon") return geom.coordinates as Position[][];
  return (geom.coordinates as Position[][][]).flatMap((poly) => poly);
}

function polygonBounds(geom: Polygon | MultiPolygon): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const ring of flattenRings(geom)) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  return { minLat, maxLat, minLng, maxLng };
}

function pickZoom(b: ReturnType<typeof polygonBounds>, targetPx: number): number {
  for (let z = 19; z >= 10; z--) {
    const px = (lng2x(b.maxLng, z) - lng2x(b.minLng, z)) * TILE_SIZE;
    const py = (lat2y(b.minLat, z) - lat2y(b.maxLat, z)) * TILE_SIZE;
    const maxDim = Math.max(px, py);
    if (maxDim <= targetPx * 0.65) return z;
  }
  return 17;
}

async function fetchTile(source: ReturnType<typeof getSource>, z: number, x: number, y: number): Promise<Buffer> {
  const url = tileUrl(source, z, x, y);
  const res = await fetch(url, {
    headers: { "User-Agent": "earth-amaearth-build/1.0 (https://earth-rouge.vercel.app)" },
  });
  if (!res.ok) throw new Error(`Tile fetch ${url} HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function getSource(tileType: TileType) {
  return TILE_SOURCES[tileType] ?? TILE_SOURCES.standard;
}

export async function renderReferenceImage(
  parcel: Feature<Polygon | MultiPolygon>,
  outSize = 640,
  tileType: TileType = "standard"
): Promise<{ dataUrl: string; zoom: number; centerLat: number; centerLng: number; tileType: TileType }> {
  const source = getSource(tileType);
  const b = polygonBounds(parcel.geometry);
  const centerLat = (b.minLat + b.maxLat) / 2;
  const centerLng = (b.minLng + b.maxLng) / 2;
  const z = pickZoom(b, outSize);

  const centerWX = lng2x(centerLng, z) * TILE_SIZE;
  const centerWY = lat2y(centerLat, z) * TILE_SIZE;
  const tlWX = centerWX - outSize / 2;
  const tlWY = centerWY - outSize / 2;

  const tileMinX = Math.floor(tlWX / TILE_SIZE);
  const tileMaxX = Math.floor((tlWX + outSize) / TILE_SIZE);
  const tileMinY = Math.floor(tlWY / TILE_SIZE);
  const tileMaxY = Math.floor((tlWY + outSize) / TILE_SIZE);

  const tilePromises: Promise<{ x: number; y: number; buf: Buffer }>[] = [];
  for (let tx = tileMinX; tx <= tileMaxX; tx++) {
    for (let ty = tileMinY; ty <= tileMaxY; ty++) {
      tilePromises.push(fetchTile(source, z, tx, ty).then((buf) => ({ x: tx, y: ty, buf })));
    }
  }
  const tiles = await Promise.all(tilePromises);

  const gridW = (tileMaxX - tileMinX + 1) * TILE_SIZE;
  const gridH = (tileMaxY - tileMinY + 1) * TILE_SIZE;

  const composites = tiles.map(({ x, y, buf }) => ({
    input: buf,
    left: (x - tileMinX) * TILE_SIZE,
    top: (y - tileMinY) * TILE_SIZE,
  }));

  function projectXY([lng, lat]: Position): [number, number] {
    const wx = lng2x(lng, z) * TILE_SIZE;
    const wy = lat2y(lat, z) * TILE_SIZE;
    return [wx - tlWX, wy - tlWY];
  }

  const rings = flattenRings(parcel.geometry);
  const svgPaths = rings
    .map((ring) => {
      const pts = ring
        .map(projectXY)
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");
      return `<polygon points="${pts}" fill="rgba(239,68,68,0.22)" stroke="rgba(239,68,68,0.95)" stroke-width="4" stroke-linejoin="round" />`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outSize}" height="${outSize}" viewBox="0 0 ${outSize} ${outSize}">${svgPaths}</svg>`;

  const cropLeft = Math.round(tlWX - tileMinX * TILE_SIZE);
  const cropTop = Math.round(tlWY - tileMinY * TILE_SIZE);

  const tileMosaic = await sharp({
    create: { width: gridW, height: gridH, channels: 3, background: { r: 240, g: 238, b: 230 } },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const cropped = await sharp(tileMosaic)
    .extract({ left: cropLeft, top: cropTop, width: outSize, height: outSize })
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .png()
    .toBuffer();

  const dataUrl = `data:image/png;base64,${cropped.toString("base64")}`;
  return { dataUrl, zoom: z, centerLat, centerLng, tileType };
}
