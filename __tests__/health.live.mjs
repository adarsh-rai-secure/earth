// Live health probe — runs against the deployed Vercel URL.
// Asserts /api/health returns ok:true with every env var set and every check.ok=true.
// Catches Vercel env-var regressions and Supabase/OpenRouter outages before they hit the demo.
//
// Usage:
//   node --test __tests__/health.live.mjs
//   LIVE_URL=https://earth-rouge.vercel.app node --test __tests__/health.live.mjs
//   LIVE_URL=http://localhost:3000 node --test __tests__/health.live.mjs   (local dev)

import { test } from "node:test";
import assert from "node:assert/strict";

const LIVE_URL = process.env.LIVE_URL ?? "https://earth-rouge.vercel.app";

async function fetchHealth() {
  const res = await fetch(`${LIVE_URL}/api/health`, { headers: { "cache-control": "no-cache" } });
  const body = await res.json();
  return { status: res.status, body };
}

test(`GET ${new URL("/api/health", LIVE_URL).href} returns 200 with ok:true`, async () => {
  const { status, body } = await fetchHealth();
  assert.equal(status, 200, `expected 200, got ${status} — body: ${JSON.stringify(body).slice(0, 300)}`);
  assert.equal(body.ok, true, `ok was false — body: ${JSON.stringify(body).slice(0, 500)}`);
});

test("every env var present", async () => {
  const { body } = await fetchHealth();
  const missing = Object.entries(body.env).filter(([, v]) => !v).map(([k]) => k);
  assert.deepEqual(missing, [], `missing env vars on ${LIVE_URL}: ${missing.join(", ")}`);
});

test("every dependency check passing", async () => {
  const { body } = await fetchHealth();
  const failed = Object.entries(body.checks)
    .filter(([, v]) => !v.ok)
    .map(([k, v]) => `${k} (${v.detail ?? "no detail"})`);
  assert.deepEqual(failed, [], `failed checks: ${failed.join(" | ")}`);
});

test("timestamp is recent (< 60s old)", async () => {
  const { body } = await fetchHealth();
  const age = Date.now() - new Date(body.timestamp).getTime();
  assert.ok(age < 60_000, `response timestamp is ${age}ms old — may be cached`);
});
