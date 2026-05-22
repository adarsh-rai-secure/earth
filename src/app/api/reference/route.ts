import { NextRequest, NextResponse } from "next/server";
import { renderReferenceImage } from "@/lib/static-map";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

type Body = {
  parcel?: Feature<Polygon | MultiPolygon>;
  size?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.parcel?.geometry) {
      return NextResponse.json({ error: "parcel GeoJSON Feature required" }, { status: 400 });
    }
    const size = Math.min(Math.max(body.size ?? 640, 256), 1024);
    const out = await renderReferenceImage(body.parcel, size);
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/reference]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
