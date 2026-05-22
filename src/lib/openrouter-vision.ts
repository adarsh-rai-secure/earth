// Vision-capable OpenRouter wrapper. Claude Sonnet 4.5 by default — it supports
// image inputs via OpenAI-style { type: "image_url", image_url: { url } } content blocks.

import type { Feature, MultiPolygon, Polygon } from "geojson";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_VISION_MODEL = "anthropic/claude-sonnet-4-5";

export type MarkResult = {
  visible: boolean;
  pixelPolygon: Array<[number, number]>; // normalized 0..1 coords
  confidence: number; // 0..1
  rationale: string;
  modelUsed: string;
};

const SYSTEM_PROMPT_BASIC = `You are a geospatial vision analyst. You receive one aerial photograph (often historical, sometimes labeled, sometimes black and white) along with a known parcel boundary in WGS84 lat/lng coordinates and an address. Your job is to identify where that parcel's footprint appears in the photograph and return its outline in normalized image coordinates.

Return strict JSON with this exact shape, no prose:

{
  "visible": boolean,
  "pixelPolygon": [[x, y], ...],
  "confidence": number,
  "rationale": string
}

Rules:
- pixelPolygon coordinates are NORMALIZED to the image: each x,y is between 0 and 1 (0,0 = top-left, 1,1 = bottom-right).
- Return 4 to 12 polygon vertices in order around the parcel.
- If you cannot confidently identify the parcel in this specific photograph (out of frame, too blurry, image is a non-aerial like a map index or text page), set visible=false, pixelPolygon=[], and explain in rationale.
- confidence is your own honest 0..1 estimate. <0.5 means "guessing", >0.8 means "I see clear visual evidence".
- rationale is one or two sentences in plain English. No markdown, no JSON inside.`;

const SYSTEM_PROMPT_WITH_REFERENCE = `You are a geospatial vision analyst. You receive TWO images and a parcel boundary in WGS84 lat/lng plus an address.

Image A is the REFERENCE: a current-day OSM map view of the subject parcel with its boundary drawn in red. Treat it as the ground-truth shape and orientation of the parcel.

Image B is the AERIAL: a historical or current aerial photograph that may or may not contain the same parcel. The aerial may be at a different scale, rotation, time period, or framing than the reference.

Your job is to find the same parcel shape (from Image A) inside Image B and return its pixel outline in normalized coordinates.

Return strict JSON with this exact shape, no prose:

{
  "visible": boolean,
  "pixelPolygon": [[x, y], ...],
  "confidence": number,
  "rationale": string
}

Rules:
- pixelPolygon coordinates are NORMALIZED to Image B (the aerial): each x,y is between 0 and 1 (0,0 = top-left, 1,1 = bottom-right).
- Return 4 to 12 polygon vertices in order around the parcel, mirroring the shape in Image A as closely as orientation/scale of Image B allows.
- The polygon should outline the WHOLE parcel (lot lines), not just one building inside it. The reference image tells you how big the parcel is relative to its surroundings.
- If you cannot confidently identify the parcel in this specific aerial (out of frame, too blurry, image is a non-aerial like a map index or text page, no recognizable landmarks), set visible=false, pixelPolygon=[], confidence=0, explain why in rationale.
- confidence is your own honest 0..1 estimate. <0.5 means "guessing", >0.8 means "I see clear visual evidence".
- rationale is one or two sentences in plain English. No markdown, no JSON inside.`;

function buildUserText(
  parcel: Feature<Polygon | MultiPolygon>,
  address: string | null
): string {
  const coords = JSON.stringify(parcel.geometry.coordinates).slice(0, 4000);
  return `Subject address: ${address ?? "(not provided)"}\n\nParcel boundary (GeoJSON WGS84 lat/lng):\n${coords}\n\nAnalyze the attached aerial photograph and return the normalized pixel polygon of this parcel within the image.`;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Model returned non-JSON: ${raw.slice(0, 200)}`);
    return JSON.parse(match[0]);
  }
}

function normalizeResult(parsed: unknown, modelUsed: string): MarkResult {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model returned non-object");
  }
  const p = parsed as Record<string, unknown>;
  const visible = Boolean(p.visible);
  const confidence = Math.max(0, Math.min(1, Number(p.confidence ?? 0) || 0));
  const rationale = typeof p.rationale === "string" ? p.rationale : "";
  const raw = Array.isArray(p.pixelPolygon) ? p.pixelPolygon : [];
  const pixelPolygon: Array<[number, number]> = raw
    .filter((pt): pt is [number, number] | { x: number; y: number } | number[] => !!pt)
    .map((pt) => {
      if (Array.isArray(pt)) return [Number(pt[0]), Number(pt[1])] as [number, number];
      const o = pt as { x: number; y: number };
      return [Number(o.x), Number(o.y)] as [number, number];
    })
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    .map(([x, y]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))] as [number, number]);

  return { visible, pixelPolygon, confidence, rationale, modelUsed };
}

export async function markParcelInImage(args: {
  imageDataUrl: string;
  parcel: Feature<Polygon | MultiPolygon>;
  address: string | null;
  referenceImageDataUrl?: string | null;
  model?: string;
}): Promise<MarkResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  const model = args.model ?? DEFAULT_VISION_MODEL;
  const useRef = !!args.referenceImageDataUrl;

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = useRef
    ? [
        { type: "text", text: `Image A (reference — parcel shape on a current map):` },
        { type: "image_url", image_url: { url: args.referenceImageDataUrl! } },
        { type: "text", text: `Image B (the aerial photograph to analyze):` },
        { type: "image_url", image_url: { url: args.imageDataUrl } },
        { type: "text", text: buildUserText(args.parcel, args.address) },
      ]
    : [
        { type: "text", text: buildUserText(args.parcel, args.address) },
        { type: "image_url", image_url: { url: args.imageDataUrl } },
      ];

  const body = {
    model,
    messages: [
      { role: "system" as const, content: useRef ? SYSTEM_PROMPT_WITH_REFERENCE : SYSTEM_PROMPT_BASIC },
      { role: "user" as const, content: userContent },
    ],
    max_tokens: 1500,
    temperature: 0.1,
    response_format: { type: "json_object" as const },
  };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://earth-rouge.vercel.app",
      "X-Title": "Earth - boundary overlay",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter vision ${res.status}: ${txt.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (data.error) throw new Error(`OpenRouter error: ${data.error.message ?? JSON.stringify(data.error)}`);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Vision model returned no content");

  return normalizeResult(tryParseJson(content), model);
}
