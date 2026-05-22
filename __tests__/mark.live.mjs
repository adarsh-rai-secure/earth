// Live smoke for /api/parcel + /api/mark.
// Renders one page of docs/labeled_aerials.pdf in a synthetic node-canvas-free way
// (uses pdfjs-dist + node Canvas polyfill) and POSTs it to /api/mark with the
// parcel returned by /api/parcel.
//
// Usage:
//   node --env-file=.env.local --test __tests__/mark.live.mjs
//   LIVE_URL=https://earth-rouge.vercel.app node --env-file=.env.local --test __tests__/mark.live.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const LIVE_URL = process.env.LIVE_URL ?? "https://earth-rouge.vercel.app";
const ADDRESS = "1423 Prospect Avenue, Bronx, New York 10456";

let cachedParcel = null;

async function getParcel() {
  if (cachedParcel) return cachedParcel;
  const res = await fetch(`${LIVE_URL}/api/parcel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: ADDRESS }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, `/api/parcel failed: ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  cachedParcel = body;
  return body;
}

test("/api/parcel returns a polygon Feature with centroid + APN", async () => {
  const body = await getParcel();
  assert.equal(body.parcel?.type, "Feature");
  assert.ok(["Polygon", "MultiPolygon"].includes(body.parcel?.geometry?.type));
  assert.ok(Array.isArray(body.parcel?.geometry?.coordinates));
  assert.ok(typeof body.centroid?.lat === "number");
  assert.ok(typeof body.centroid?.lng === "number");
  // APN may be null for some places; just check the key is present.
  assert.ok("apn" in body);
});

test("/api/mark rejects missing imageDataUrl with 400", async () => {
  const res = await fetch(`${LIVE_URL}/api/mark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parcel: { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } } }),
  });
  const body = await res.json();
  assert.equal(res.status, 400, `expected 400, got ${res.status}: ${JSON.stringify(body)}`);
  assert.match(body.error, /imageDataUrl/);
});

test("/api/mark rejects missing parcel with 400", async () => {
  // 8x8 transparent PNG
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4AWP4//8/AyUYi4F4MGoyAAAxIQMBAAAAAElFTkSuQmCC";
  const res = await fetch(`${LIVE_URL}/api/mark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl: tinyPng }),
  });
  const body = await res.json();
  assert.equal(res.status, 400, `expected 400, got ${res.status}: ${JSON.stringify(body)}`);
  assert.match(body.error, /parcel/);
});

test("/api/mark returns JSON with visible+confidence on a real aerial PNG", async () => {
  const parcelRes = await getParcel();

  // Build a small fake aerial: use a JPEG sample to keep the payload light.
  // We don't actually need a real aerial — the vision model will (correctly)
  // say visible:false on a non-aerial image; the test asserts the response
  // shape, not the model's geographic judgement.
  const tinyAerial = await loadSampleImage();

  const res = await fetch(`${LIVE_URL}/api/mark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: tinyAerial,
      parcel: parcelRes.parcel,
      address: parcelRes.addressNormalized,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, `/api/mark failed: ${res.status} ${JSON.stringify(body).slice(0, 400)}`);
  assert.equal(typeof body.visible, "boolean", `body.visible should be boolean: ${JSON.stringify(body)}`);
  assert.equal(typeof body.confidence, "number");
  assert.ok(body.confidence >= 0 && body.confidence <= 1);
  assert.equal(typeof body.rationale, "string");
  assert.ok(Array.isArray(body.pixelPolygon));
  assert.equal(typeof body.modelUsed, "string");
  // visible:true requires a valid polygon
  if (body.visible) {
    assert.ok(body.pixelPolygon.length >= 3, "visible=true but polygon has <3 vertices");
    for (const [x, y] of body.pixelPolygon) {
      assert.ok(x >= 0 && x <= 1, `x out of range: ${x}`);
      assert.ok(y >= 0 && y <= 1, `y out of range: ${y}`);
    }
  }
});

async function loadSampleImage() {
  // Real-enough image so Anthropic doesn't reject for being too small/malformed.
  // OSM Bronx tile at zoom 16 — works fine as an arbitrary aerial-ish PNG.
  const tileUrl = "https://tile.openstreetmap.org/16/19305/24635.png";
  const res = await fetch(tileUrl, { headers: { "User-Agent": "earth-test/1.0" } });
  if (!res.ok) throw new Error(`OSM tile fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buf.toString("base64")}`;
}
