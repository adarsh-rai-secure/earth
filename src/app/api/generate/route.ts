import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateJSON } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an environmental assessment analyst supporting Phase I ESA report drafting per ASTM E1527-21. Analyze the provided document text and produce a strict JSON object with these keys:

{
  "property_summary": string — 2-4 sentences on subject property and current use,
  "historical_uses": Array<{ "period": string, "use": string, "source_excerpt": string }>,
  "environmental_concerns": Array<{ "title": string, "description": string, "evidence": string }>,
  "regulatory_findings": Array<{ "database": string, "site_name": string, "distance": string, "status": string }>,
  "classifications": Array<{ "type": "REC" | "HREC" | "CREC" | "de_minimis", "description": string, "rationale": string }>,
  "executive_summary": string — 4-6 sentences a consultant would lead the report with
}

Be specific and cite exact strings from the document under "source_excerpt" / "evidence" when possible. If a section has no findings, return an empty array. Output ONLY the JSON object, no prose.`;

export async function POST(req: NextRequest) {
  try {
    const { documentId, model } = (await req.json()) as { documentId?: string; model?: string };
    if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

    const sb = getSupabaseAdmin();

    const { data: doc, error: fetchErr } = await sb
      .from("documents")
      .select("id, raw_text, filename")
      .eq("id", documentId)
      .single();
    if (fetchErr || !doc) throw new Error(`Document not found: ${fetchErr?.message ?? documentId}`);
    if (!doc.raw_text) throw new Error("No raw_text on document — run /api/extract first");

    await sb.from("documents").update({ status: "generating", updated_at: new Date().toISOString() }).eq("id", documentId);

    const userMessage = `Source filename: ${doc.filename}\n\n--- DOCUMENT TEXT (truncated to 60k chars) ---\n${doc.raw_text.slice(0, 60_000)}`;
    const report = await generateJSON<Record<string, unknown>>(SYSTEM_PROMPT, userMessage, { model });

    const { error: upErr } = await sb
      .from("documents")
      .update({
        report,
        status: "complete",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);
    if (upErr) throw new Error(`Update failed: ${upErr.message}`);

    return NextResponse.json({ documentId, status: "complete", report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/generate]", msg);
    try {
      const sb = getSupabaseAdmin();
      const { documentId } = (await req.clone().json().catch(() => ({}))) as { documentId?: string };
      if (documentId) {
        await sb
          .from("documents")
          .update({ status: "error", error_message: msg, updated_at: new Date().toISOString() })
          .eq("id", documentId);
      }
    } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
