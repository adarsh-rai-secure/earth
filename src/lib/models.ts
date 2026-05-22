export type ModelChoice = {
  id: string;
  label: string;
  provider: string;
  blurb: string;
  tier: "premium" | "balanced" | "cheap" | "free";
};

// Curated for the AMA Earth demo: mix of providers + price tiers so we can show
// how different models render the same Phase I ESA draft. Adjust freely.
export const MODELS: ModelChoice[] = [
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    provider: "Anthropic",
    blurb: "Best overall — structured, careful, strong at citations.",
    tier: "premium",
  },
  {
    id: "anthropic/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    blurb: "Fast and inexpensive — good baseline Claude output.",
    tier: "cheap",
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    provider: "OpenAI",
    blurb: "OpenAI flagship — different rhetorical style, dense findings.",
    tier: "premium",
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 Mini",
    provider: "OpenAI",
    blurb: "Cheap OpenAI — useful as a quick second opinion.",
    tier: "cheap",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    blurb: "Very fast, low cost — Google's perspective on the same doc.",
    tier: "cheap",
  },
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek V3.2",
    provider: "DeepSeek",
    blurb: "Ultra-cheap OSS — surprisingly strong on structured extraction.",
    tier: "cheap",
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;
