"use client";

import { useCallback, useRef, useState } from "react";
import { getSupabaseBrowser, BUCKET } from "@/lib/supabase";

export type UploadResult = { documentId: string; filename: string; fileUrl: string; status: string };

function sanitizePath(name: string): string {
  return `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

export function FileUpload({
  onUploaded,
  onFile,
}: {
  onUploaded: (r: UploadResult) => void;
  onFile?: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      onFile?.(file);
      setBusy(true);
      setErr(null);
      setProgress(`Uploading ${(file.size / 1_048_576).toFixed(1)} MB to storage…`);
      try {
        const sb = getSupabaseBrowser();
        const storagePath = sanitizePath(file.name);

        const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, file, {
          contentType: file.type || "application/pdf",
          upsert: false,
        });
        if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

        setProgress("Creating document record…");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath, filename: file.name }),
        });
        const text = await res.text();
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Server returned non-JSON (HTTP ${res.status}): ${text.slice(0, 160)}`);
        }
        const result = data as Partial<UploadResult> & { error?: string };
        if (!res.ok) throw new Error(result.error ?? `HTTP ${res.status}`);
        onUploaded(result as UploadResult);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        setProgress("");
      }
    },
    [onUploaded, onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
        dragging ? "border-brand bg-brand/5" : "border-border bg-card hover:border-foreground/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      {busy ? (
        <p className="text-sm text-muted">{progress || "Uploading…"}</p>
      ) : (
        <>
          <p className="text-sm font-medium">Drop a PDF here, or click to choose</p>
          <p className="mt-1 text-xs text-muted">City directories, radius maps, regulatory exports, prior reports</p>
        </>
      )}
      {err && <p className="mt-3 max-w-md text-center text-xs text-error">{err}</p>}
    </div>
  );
}
