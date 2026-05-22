"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from "leaflet";
import type { Feature, Polygon, MultiPolygon } from "geojson";

type Props = {
  parcel: Feature<Polygon | MultiPolygon> | null;
  centroid: { lat: number; lng: number } | null;
  height?: number;
};

// We dynamic-import leaflet inside useEffect so it never runs during SSR.
export default function ParcelMap({ parcel, centroid, height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          center: centroid ? [centroid.lat, centroid.lng] : [39.8283, -98.5795],
          zoom: centroid ? 18 : 4,
          zoomControl: true,
          attributionControl: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        }).addTo(map);
        mapRef.current = map;
      }

      const map = mapRef.current!;

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }

      if (parcel) {
        const layer = L.geoJSON(parcel, {
          style: {
            color: "#2d5a3d",
            weight: 3,
            fillColor: "#22c55e",
            fillOpacity: 0.18,
          },
        }).addTo(map);
        layerRef.current = layer;
        try {
          const b = layer.getBounds();
          if (b.isValid()) map.fitBounds(b, { padding: [24, 24] });
        } catch {}
      } else if (centroid) {
        map.setView([centroid.lat, centroid.lng], 18);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parcel, centroid]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-2xl border border-border bg-card"
      style={{ height }}
    />
  );
}
