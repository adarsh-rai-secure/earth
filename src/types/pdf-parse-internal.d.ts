declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFParseResult {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  }
  function pdf(data: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PDFParseResult>;
  export default pdf;
}
