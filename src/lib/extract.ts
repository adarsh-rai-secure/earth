// pdf-parse v1.x — import the inner file to skip the package's index.js debug-mode block
// (the index.js tries to read a test PDF on load, which fails on serverless)
import pdf from "pdf-parse/lib/pdf-parse.js";

export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer);
  return result.text ?? "";
}

export async function extractTextFromBlob(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer();
  return extractTextFromBuffer(Buffer.from(ab));
}

export async function extractTextFromURL(fileUrl: string): Promise<string> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  return extractTextFromBuffer(Buffer.from(ab));
}
