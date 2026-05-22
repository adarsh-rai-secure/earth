import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { lookupByAddress, lookupByPoint } from "@/lib/regrid";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { address } = (await req.json()) as { address?: string };
    if (!address || typeof address !== "string" || address.trim().length < 3) {
      return NextResponse.json({ error: "address is required (min 3 chars)" }, { status: 400 });
    }

    const geo = await geocodeAddress(address.trim());

    // Prefer point lookup (more precise to the geocoded coords).
    // Fall back to address lookup if point returns nothing.
    let parcel;
    try {
      parcel = await lookupByPoint(geo.lat, geo.lng);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[api/parcel] point lookup failed, falling back to address:", msg);
      parcel = await lookupByAddress(address);
    }

    return NextResponse.json({
      parcel: parcel.feature,
      apn: parcel.apn,
      acreage: parcel.acreage,
      addressNormalized: parcel.addressNormalized ?? geo.displayName,
      centroid: parcel.centroid ?? { lat: geo.lat, lng: geo.lng },
      geocoded: { lat: geo.lat, lng: geo.lng, displayName: geo.displayName },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/parcel]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
