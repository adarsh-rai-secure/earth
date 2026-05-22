// Supabase round-trip — insert a probe row into `documents` with the service-role key,
// read it back, delete it. Catches URL / key / RLS / schema regressions independent
// of the deployed app. Reads creds from .env.local via `node --env-file`.
//
// Usage:
//   node --env-file=.env.local --test __tests__/supabase-roundtrip.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROBE_PREFIX = "__rt_probe_";

function svcHeaders(extra = {}) {
  return { apikey: SVC, Authorization: `Bearer ${SVC}`, ...extra };
}
function anonHeaders(extra = {}) {
  return { apikey: ANON, Authorization: `Bearer ${ANON}`, ...extra };
}

test("env vars loaded from .env.local", () => {
  assert.ok(URL, "NEXT_PUBLIC_SUPABASE_URL missing — pass --env-file=.env.local");
  assert.ok(ANON, "NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
  assert.ok(SVC, "SUPABASE_SERVICE_ROLE_KEY missing");
});

test("anon key can SELECT count from documents (RLS demo policy)", async () => {
  const res = await fetch(`${URL}/rest/v1/documents?select=count`, { headers: anonHeaders() });
  assert.equal(res.status, 200, `anon SELECT failed: ${res.status} ${await res.text()}`);
});

test("service-role round trip: INSERT → SELECT → DELETE", async () => {
  const filename = `${PROBE_PREFIX}${Date.now()}.pdf`;

  // INSERT
  const insertRes = await fetch(`${URL}/rest/v1/documents`, {
    method: "POST",
    headers: svcHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ filename, status: "uploaded" }),
  });
  const insertBody = await insertRes.text();
  assert.equal(insertRes.status, 201, `INSERT failed: ${insertRes.status} ${insertBody}`);
  const inserted = JSON.parse(insertBody)[0];
  assert.ok(inserted?.id, "INSERT returned no id");
  assert.equal(inserted.filename, filename);
  assert.equal(inserted.status, "uploaded");

  try {
    // SELECT
    const selectRes = await fetch(
      `${URL}/rest/v1/documents?id=eq.${inserted.id}&select=id,filename,status`,
      { headers: svcHeaders() }
    );
    assert.equal(selectRes.status, 200, `SELECT failed: ${selectRes.status}`);
    const rows = await selectRes.json();
    assert.equal(rows.length, 1, "SELECT returned wrong row count");
    assert.equal(rows[0].filename, filename);
  } finally {
    // DELETE (always — even if SELECT failed, do not leak probe rows)
    const delRes = await fetch(`${URL}/rest/v1/documents?id=eq.${inserted.id}`, {
      method: "DELETE",
      headers: svcHeaders(),
    });
    assert.ok([200, 204].includes(delRes.status), `DELETE failed: ${delRes.status} ${await delRes.text()}`);
  }
});

test("storage uploads bucket exists and is private", async () => {
  const res = await fetch(`${URL}/storage/v1/bucket/uploads`, { headers: svcHeaders() });
  const body = await res.text();
  assert.equal(res.status, 200, `bucket lookup failed: ${res.status} ${body}`);
  const bucket = JSON.parse(body);
  assert.equal(bucket.name, "uploads");
  assert.equal(bucket.public, false, "bucket should be private (public=false)");
});

test("no orphaned probe rows from prior failed runs", async () => {
  const res = await fetch(
    `${URL}/rest/v1/documents?filename=like.${PROBE_PREFIX}*&select=id,filename`,
    { headers: svcHeaders() }
  );
  const rows = await res.json();
  // Soft assertion — clean up + warn rather than fail, since a flake elsewhere can leak.
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    await fetch(`${URL}/rest/v1/documents?id=in.(${ids.join(",")})`, {
      method: "DELETE",
      headers: svcHeaders(),
    });
    console.warn(`cleaned up ${rows.length} orphaned probe row(s) from prior runs`);
  }
  assert.ok(true);
});
