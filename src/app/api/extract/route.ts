import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, BUCKET } from "@/lib/supabase";
import { extractTextFromBuffer } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { documentId } = (await req.json()) as { documentId?: string };
    if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

    const sb = getSupabaseAdmin();

    const { data: doc, error: fetchErr } = await sb
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (fetchErr || !doc) throw new Error(`Document not found: ${fetchErr?.message ?? documentId}`);

    await sb.from("documents").update({ status: "extracting", updated_at: new Date().toISOString() }).eq("id", documentId);

    const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(doc.storage_path);
    if (dlErr || !blob) throw new Error(`Download failed: ${dlErr?.message}`);

    const buf = Buffer.from(await blob.arrayBuffer());
    const rawText = await extractTextFromBuffer(buf);

    const { error: upErr } = await sb
      .from("documents")
      .update({
        raw_text: rawText,
        status: "extracted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);
    if (upErr) throw new Error(`Update failed: ${upErr.message}`);

    return NextResponse.json({
      documentId,
      status: "extracted",
      textLength: rawText.length,
      preview: rawText.slice(0, 500),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/extract]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
