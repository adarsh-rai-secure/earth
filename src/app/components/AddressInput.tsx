"use client";

import { useState } from "react";
import type { Feature, Polygon, MultiPolygon } from "geojson";

export type ParcelLookupResult = {
  parcel: Feature<Polygon | MultiPolygon>;
  apn: string | null;
  acreage: number | null;
  addressNormalized: string;
  centroid: { lat: number; lng: number };
  geocoded: { lat: number; lng: number; displayName: string };
};

export function AddressInput({
  address,
  setAddress,
  onResult,
  busy,
  setBusy,
}: {
  address: string;
  setAddress: (a: string) => void;
  onResult: (r: ParcelLookupResult) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const [err, setErr] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!address.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/parcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      onResult(data as ParcelLookupResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
        Subject property address
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="1423 Prospect Avenue, Bronx, NY 10456"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !address.trim()}
          className="inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Looking up…" : "Look up parcel"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-error">{err}</p>}
      <p className="mt-2 text-[11px] text-muted">
        Geocoded via Nominatim (OpenStreetMap), parcel via Regrid v2.
      </p>
    </form>
  );
}
