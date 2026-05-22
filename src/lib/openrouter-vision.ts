// Vision-capable OpenRouter wrapper.
// Supports up to three image inputs:
//   - Regrid reference (parcel polygon on a current map/satellite tile)
//   - Previous marked aerial (a page the user already confirmed in this same series)
//   - The aerial under analysis

import type { Feature, MultiPolygon, Polygon } from "geojson";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_VISION_MODEL = "anthropic/claude-sonnet-4-5";

export type MarkResult = {
  visible: boolean;
  pixelPolygon: Array<[number, number]>;
  confidence: number;
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

Image A is the REFERENCE: a current-day map view of the subject parcel with its boundary drawn in red. Treat it as the ground-truth shape and orientation of the parcel.

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
- pixelPolygon coordinates are NORMALIZED to Image B (the aerial): each x,y is between 0 and 1.
- Return 4 to 12 polygon vertices in order around the parcel, mirroring the shape in Image A.
- The polygon should outline the WHOLE parcel (lot lines), not just one building inside it.
- If the parcel is not identifiable in Image B, set visible=false, pixelPolygon=[], confidence=0.
- rationale is one or two sentences in plain English. No markdown.`;

const SYSTEM_PROMPT_WITH_PRIOR = `You are a geospatial vision analyst. You receive THREE images and a parcel boundary in WGS84 lat/lng plus an address.

Image A is the MAP REFERENCE: a current-day map view of the subject parcel with its boundary drawn in red. Treat it as the ground-truth shape and orientation of the parcel.

Image B is the PRIOR CONFIRMED EXAMPLE: another aerial from this same series where a human has already drawn (or accepted) the correct parcel boundary in red. The new aerial you are analyzing is from the same PDF, same subject property, possibly different year/scale/orientation. Use Image B as a style/example reference for how the parcel appears in this aerial series and where it sits relative to surrounding features.

Image C is the NEW AERIAL: the aerial photograph you must analyze now.

Your job: find the same parcel inside Image C and return its pixel outline in normalized coordinates.

Return strict JSON with this exact shape, no prose:

{
  "visible": boolean,
  "pixelPolygon": [[x, y], ...],
  "confidence": number,
  "rationale": string
}

Rules:
- pixelPolygon coordinates are NORMALIZED to Image C: each x,y is between 0 and 1.
- Return 4 to 12 polygon vertices in order around the parcel.
- The polygon should outline the WHOLE parcel (lot lines), not just one building.
- Use Image B's drawn polygon as a strong prior for shape and visual context. Streets, neighboring buildings, and the parcel's relative position to landmarks should look similar in Image C.
- If the parcel isn't identifiable in Image C (out of frame, image is a cover/index page, blurred beyond recognition), set visible=false, pixelPolygon=[], confidence=0.
- rationale is one or two sentences referencing both the map reference (Image A) and the prior example (Image B) when possible. No markdown.`;

function buildUserText(
  parcel: Feature<Polygon | MultiPolygon>,
  address: string | null
): string {
  const coords = JSON.stringify(parcel.geometry.coordinates).slice(0, 4000);
  return `Subject address: ${address ?? "(not provided)"}\n\nParcel boundary (GeoJSON WGS84 lat/lng):\n${coords}\n\nReturn the normalized pixel polygon of this parcel within the new aerial image.`;
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
  if (!parsed || typeof parsed !== "object") throw new Error("Model returned non-object");
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
  previousMarkedImageDataUrl?: string | null;
  model?: string;
}): Promise<MarkResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  const model = args.model ?? DEFAULT_VISION_MODEL;
  const hasRef = !!args.referenceImageDataUrl;
  const hasPrior = !!args.previousMarkedImageDataUrl;

  const systemPrompt = hasPrior
    ? SYSTEM_PROMPT_WITH_PRIOR
    : hasRef
      ? SYSTEM_PROMPT_WITH_REFERENCE
      : SYSTEM_PROMPT_BASIC;

  const userContent: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [];

  if (hasRef) {
    userContent.push({ type: "text", text: "Image A — map reference (parcel shape on current map):" });
    userContent.push({ type: "image_url", image_url: { url: args.referenceImageDataUrl! } });
  }
  if (hasPrior) {
    userContent.push({
      type: "text",
      text: "Image B — prior confirmed aerial in this same series (use shape and relative position as a strong hint):",
    });
    userContent.push({ type: "image_url", image_url: { url: args.previousMarkedImageDataUrl! } });
  }
  userContent.push({
    type: "text",
    text: hasPrior ? "Image C — new aerial to analyze:" : hasRef ? "Image B — new aerial to analyze:" : "Aerial to analyze:",
  });
  userContent.push({ type: "image_url", image_url: { url: args.imageDataUrl } });
  userContent.push({ type: "text", text: buildUserText(args.parcel, args.address) });

  const body = {
    model,
    messages: [
      { role: "system" as const, content: systemPrompt },
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
