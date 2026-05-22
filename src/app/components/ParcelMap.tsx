"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON, TileLayer as LeafletTileLayer } from "leaflet";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { TILE_SOURCES, type TileType } from "@/lib/map-tiles";

type Props = {
  parcel: Feature<Polygon | MultiPolygon> | null;
  centroid: { lat: number; lng: number } | null;
  tileType?: TileType;
  height?: number;
};

export default function ParcelMap({ parcel, centroid, tileType = "standard", height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<LeafletTileLayer | null>(null);
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
        mapRef.current = map;
      }

      const map = mapRef.current!;
      const source = TILE_SOURCES[tileType];

      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
      tileLayerRef.current = L.tileLayer(source.urlTemplate, {
        maxZoom: source.maxZoom,
        attribution: source.attribution,
        subdomains: source.subdomains ?? "abc",
      }).addTo(map);

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }

      if (parcel) {
        const layer = L.geoJSON(parcel, {
          style: {
            color: "#2d5a3d",
            weight: 3,
            fillColor: tileType === "satellite" ? "#22c55e" : "#22c55e",
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
  }, [parcel, centroid, tileType]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-2xl border border-border bg-card"
      style={{ height }}
    />
  );
}
