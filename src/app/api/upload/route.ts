import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

// Client uploads the file directly to Supabase Storage (anon key + demo_uploads_all RLS).
// This route only creates the documents row + signed URL — no file bytes traverse Vercel,
// so the 4.5 MB serverless body limit (FUNCTION_PAYLOAD_TOO_LARGE) no longer applies.
const STORAGE_PATH_RE = /^[0-9]{10,16}-[a-zA-Z0-9._-]+$/;

export async function POST(req: NextRequest) {
  try {
    const { storagePath, filename } = (await req.json()) as {
      storagePath?: string;
      filename?: string;
    };

    if (!storagePath || !filename) {
      return NextResponse.json({ error: "storagePath and filename required" }, { status: 400 });
    }
    if (!STORAGE_PATH_RE.test(storagePath)) {
      return NextResponse.json({ error: "Invalid storagePath format" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Confirm the client actually uploaded the file before we mint a DB row.
    const folder = "";
    const { data: list, error: listErr } = await sb.storage.from(BUCKET).list(folder, {
      search: storagePath,
      limit: 1,
    });
    if (listErr) throw new Error(`Storage list failed: ${listErr.message}`);
    if (!list?.some((o) => o.name === storagePath)) {
      return NextResponse.json(
        { error: "Storage object not found — upload must complete before calling /api/upload" },
        { status: 404 }
      );
    }

    const { data: signed, error: signErr } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24);
    if (signErr) throw new Error(`Signed URL failed: ${signErr.message}`);

    const { data: doc, error: dbErr } = await sb
      .from("documents")
      .insert({
        filename,
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
