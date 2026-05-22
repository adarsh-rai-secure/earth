// Map tile type choices used by both the live Leaflet view and server-side reference render.

export type TileType = "standard" | "satellite";

export type TileSource = {
  id: TileType;
  label: string;
  urlTemplate: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
};

export const TILE_SOURCES: Record<TileType, TileSource> = {
  standard: {
    id: "standard",
    label: "Standard map",
    urlTemplate: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19,
    subdomains: ["a", "b", "c"],
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    urlTemplate:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri World Imagery",
    maxZoom: 19,
  },
};

export function tileUrl(source: TileSource, z: number, x: number, y: number): string {
  let sub = "";
  if (source.subdomains && source.subdomains.length > 0) {
    sub = source.subdomains[((x + y) % source.subdomains.length + source.subdomains.length) %
      source.subdomains.length];
  }
  return source.urlTemplate
    .replace("{s}", sub)
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}
