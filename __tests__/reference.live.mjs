// Live smoke for /api/reference + /api/mark with reference image.
//
// Usage:
//   node --test __tests__/reference.live.mjs
//   LIVE_URL=https://earth-rouge.vercel.app node --test __tests__/reference.live.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

const LIVE_URL = process.env.LIVE_URL ?? "https://earth-rouge.vercel.app";
const ADDRESS = "1423 Prospect Avenue, Bronx, New York 10456";

let cachedParcel = null;
let cachedReference = null;

async function getParcel() {
  if (cachedParcel) return cachedParcel;
  const res = await fetch(`${LIVE_URL}/api/parcel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: ADDRESS }),
  });
  cachedParcel = await res.json();
  return cachedParcel;
}

test("/api/reference rejects missing parcel with 400", async () => {
  const res = await fetch(`${LIVE_URL}/api/reference`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assert.equal(res.status, 400, `expected 400, got ${res.status}: ${JSON.stringify(body)}`);
  assert.match(body.error, /parcel/);
});

test("/api/reference returns a PNG dataUrl with zoom + center", async () => {
  const parcel = await getParcel();
  const res = await fetch(`${LIVE_URL}/api/reference`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parcel: parcel.parcel }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  assert.ok(typeof body.dataUrl === "string", "dataUrl missing");
  assert.match(body.dataUrl, /^data:image\/png;base64,/, "dataUrl wrong shape");
  assert.ok(body.dataUrl.length > 5000, `dataUrl looks too small: ${body.dataUrl.length} chars`);
  assert.equal(typeof body.zoom, "number");
  assert.ok(body.zoom >= 12 && body.zoom <= 19, `unexpected zoom ${body.zoom}`);
  assert.equal(typeof body.centerLat, "number");
  assert.equal(typeof body.centerLng, "number");
  cachedReference = body.dataUrl;
});

test("/api/mark accepts referenceImageDataUrl and still returns valid shape", async () => {
  const parcel = await getParcel();
  if (!cachedReference) {
    // first time: regenerate
    const r = await fetch(`${LIVE_URL}/api/reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel: parcel.parcel }),
    });
    cachedReference = (await r.json()).dataUrl;
  }

  // Use an OSM tile as the aerial — vision will say either visible or not,
  // we just verify shape compatibility.
  const tile = await fetch("https://tile.openstreetmap.org/16/19305/24635.png", {
    headers: { "User-Agent": "earth-test/1.0" },
  });
  const aerialDataUrl = `data:image/png;base64,${Buffer.from(await tile.arrayBuffer()).toString("base64")}`;

  const res = await fetch(`${LIVE_URL}/api/mark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: aerialDataUrl,
      parcel: parcel.parcel,
      address: parcel.addressNormalized,
      referenceImageDataUrl: cachedReference,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, `/api/mark with reference failed: ${res.status} ${JSON.stringify(body).slice(0, 400)}`);
  assert.equal(typeof body.visible, "boolean");
  assert.equal(typeof body.confidence, "number");
  assert.ok(Array.isArray(body.pixelPolygon));
  if (body.visible) {
    assert.ok(body.pixelPolygon.length >= 3, "visible=true but polygon has <3 vertices");
  }
});
