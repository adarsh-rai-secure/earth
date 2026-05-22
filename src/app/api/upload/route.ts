import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/pdf",
      upsert: false,
    });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: signed, error: signErr } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24);
    if (signErr) throw new Error(`Signed URL failed: ${signErr.message}`);

    const { data: doc, error: dbErr } = await sb
      .from("documents")
      .insert({
        filename: file.name,
        file_url: signed.signedUrl,
        storage_path: storagePath,
        status: "uploaded",
      })
      .select()
      .single();
    if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);

    return NextResponse.json({
      documentId: doc.id,
      filename: doc.filename,
      fileUrl: doc.file_url,
      status: doc.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/upload]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
