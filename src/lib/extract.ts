import { PDFParse } from "pdf-parse";

export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function extractTextFromBlob(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer();
  return extractTextFromBuffer(Buffer.from(ab));
}

export async function extractTextFromURL(fileUrl: string): Promise<string> {
  const parser = new PDFParse({ url: fileUrl });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}
