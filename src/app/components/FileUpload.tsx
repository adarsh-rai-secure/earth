"use client";

import { useCallback, useRef, useState } from "react";

export type UploadResult = { documentId: string; filename: string; fileUrl: string; status: string };

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
  const [err, setErr] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      onFile?.(file);
      setBusy(true);
      setErr(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        onUploaded(data as UploadResult);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
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
        <p className="text-sm text-muted">Uploading…</p>
      ) : (
        <>
          <p className="text-sm font-medium">Drop a PDF here, or click to choose</p>
          <p className="mt-1 text-xs text-muted">City directories, radius maps, regulatory exports, prior reports</p>
        </>
      )}
      {err && <p className="mt-3 text-xs text-error">{err}</p>}
    </div>
  );
}
