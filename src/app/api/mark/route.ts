import { NextRequest, NextResponse } from "next/server";
import { markParcelInImage } from "@/lib/openrouter-vision";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel default body limit is ~4.5 MB. We accept the image as a data URL inline.
// Client should downsample to 1024px max side before posting (vision quality is fine at that size).
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb",
    },
  },
};

type Body = {
  imageDataUrl?: string;
  parcel?: Feature<Polygon | MultiPolygon>;
  address?: string | null;
  referenceImageDataUrl?: string | null;
  model?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.imageDataUrl || !body.imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "imageDataUrl required (must be a data:image/* URL)" },
        { status: 400 }
      );
    }
    if (!body?.parcel?.geometry) {
      return NextResponse.json({ error: "parcel GeoJSON Feature required" }, { status: 400 });
    }

    const result = await markParcelInImage({
      imageDataUrl: body.imageDataUrl,
      parcel: body.parcel,
      address: body.address ?? null,
      referenceImageDataUrl: body.referenceImageDataUrl ?? null,
      model: body.model,
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/mark]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
