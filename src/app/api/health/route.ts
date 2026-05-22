import { NextResponse } from "next/server";
import { getSupabaseAdmin, BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type CheckResult = { ok: boolean; detail?: string };
type Health = {
  ok: boolean;
  env: Record<string, boolean>;
  checks: {
    supabase_documents_table: CheckResult;
    supabase_uploads_bucket: CheckResult;
    openrouter_reachable: CheckResult;
  };
  timestamp: string;
};

export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
  };

  const checks: Health["checks"] = {
    supabase_documents_table: { ok: false },
    supabase_uploads_bucket: { ok: false },
    openrouter_reachable: { ok: false },
  };

  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("documents").select("id", { count: "exact", head: true });
    if (error) checks.supabase_documents_table = { ok: false, detail: error.message };
    else checks.supabase_documents_table = { ok: true };
  } catch (e) {
    checks.supabase_documents_table = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.storage.listBuckets();
    if (error) checks.supabase_uploads_bucket = { ok: false, detail: error.message };
    else {
      const found = data?.find((b) => b.name === BUCKET);
      checks.supabase_uploads_bucket = found
        ? { ok: true, detail: `bucket '${BUCKET}' exists` }
        : { ok: false, detail: `bucket '${BUCKET}' not found — create it in Supabase Storage dashboard` };
    }
  } catch (e) {
    checks.supabase_uploads_bucket = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }

  try {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      checks.openrouter_reachable = { ok: false, detail: "OPENROUTER_API_KEY not set" };
    } else {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
      });
      checks.openrouter_reachable = res.ok
        ? { ok: true, detail: `models endpoint ${res.status}` }
        : { ok: false, detail: `HTTP ${res.status}` };
    }
  } catch (e) {
    checks.openrouter_reachable = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }

  const ok =
    Object.values(env).every(Boolean) &&
    checks.supabase_documents_table.ok &&
    checks.supabase_uploads_bucket.ok &&
    checks.openrouter_reachable.ok;

  const body: Health = { ok, env, checks, timestamp: new Date().toISOString() };
  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
