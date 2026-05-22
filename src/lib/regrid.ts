// Regrid v2 parcel lookup
// Docs: https://app.regrid.com/store/api/v2

import type { Feature, Polygon, MultiPolygon } from "geojson";

const REGRID_BASE = "https://app.regrid.com/api/v2/parcels";

export type RegridParcel = {
  feature: Feature<Polygon | MultiPolygon, RegridProps>;
  apn: string | null;
  acreage: number | null;
  addressNormalized: string | null;
  centroid: { lat: number; lng: number } | null;
};

type RegridProps = Record<string, unknown> & {
  fields?: {
    parcelnumb?: string;
    parcelnumb_no_formatting?: string;
    address?: string;
    saddress?: string;
    gisacre?: number;
    ll_gisacre?: number;
    lat?: string | number;
    lon?: string | number;
    [k: string]: unknown;
  };
};

function ensureToken(): string {
  const t = process.env.REGRID_API_TOKEN;
  if (!t || t.trim().length < 10) {
    throw new Error("REGRID_API_TOKEN is missing or invalid");
  }
  return t.trim();
}

function parseFeature(raw: unknown): RegridParcel {
  // Regrid v2 wraps the FeatureCollection inside a `parcels` key:
  //   { parcels: { type: "FeatureCollection", features: [ ... ] } }
  // Tolerate both shapes in case the wrapper changes.
  if (!raw || typeof raw !== "object") {
    throw new Error("Regrid: empty response");
  }
  const obj = raw as Record<string, unknown>;
  const fc = (obj.parcels && typeof obj.parcels === "object" ? obj.parcels : obj) as Record<
    string,
    unknown
  >;
  const features = Array.isArray(fc.features) ? (fc.features as unknown[]) : null;
  if (!features) {
    throw new Error("Regrid: unexpected response shape (no features)");
  }
  if (features.length === 0) {
    throw new Error("Regrid: no parcel found for this location");
  }
  const feature = features[0] as RegridParcel["feature"];
  const props = (feature?.properties ?? {}) as RegridProps;
  const f = props.fields ?? {};

  const apn = (f.parcelnumb ?? f.parcelnumb_no_formatting ?? null) as string | null;
  const acreage = ((f.gisacre ?? f.ll_gisacre) ?? null) as number | null;
  const addressNormalized = ((f.address ?? f.saddress) ?? null) as string | null;
  const latRaw = f.lat;
  const lngRaw = f.lon;
  const centroid =
    latRaw != null && lngRaw != null
      ? { lat: Number(latRaw), lng: Number(lngRaw) }
      : null;

  return { feature, apn, acreage, addressNormalized, centroid };
}

export async function lookupByAddress(address: string): Promise<RegridParcel> {
  const token = ensureToken();
  const url = `${REGRID_BASE}/address?query=${encodeURIComponent(address)}&limit=1&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Regrid /address ${res.status}: ${body.slice(0, 200)}`);
  }
  return parseFeature(await res.json());
}

export async function lookupByPoint(lat: number, lng: number): Promise<RegridParcel> {
  const token = ensureToken();
  const url = `${REGRID_BASE}/point?lat=${lat}&lon=${lng}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Regrid /point ${res.status}: ${body.slice(0, 200)}`);
  }
  return parseFeature(await res.json());
}
