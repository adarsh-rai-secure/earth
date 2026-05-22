const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "anthropic/claude-sonnet-4-5";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function generateCompletion(
  systemPrompt: string,
  userMessage: string,
  opts: { model?: string; jsonMode?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://earth-rouge.vercel.app",
      "X-Title": "Earth - AMA Earth Live Build Scaffold",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0, 500)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (data.error) throw new Error(`OpenRouter error: ${data.error.message ?? JSON.stringify(data.error)}`);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter returned no content");
  return content;
}

export async function generateJSON<T = unknown>(
  systemPrompt: string,
  userMessage: string,
  opts: { model?: string; maxTokens?: number; temperature?: number } = {}
): Promise<T> {
  const raw = await generateCompletion(systemPrompt, userMessage, { ...opts, jsonMode: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`OpenRouter returned non-JSON: ${raw.slice(0, 200)}`);
    return JSON.parse(match[0]) as T;
  }
}
