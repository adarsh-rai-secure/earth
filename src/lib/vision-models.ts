export type VisionModelChoice = {
  id: string;
  label: string;
  provider: string;
  tier: "best" | "best-alt" | "cheap-fast" | "cheapest";
  blurb: string;
  approxCostPerPage: string;
};

// Curated set for the boundary-overlay use case. All support multimodal input.
export const VISION_MODELS: VisionModelChoice[] = [
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    provider: "Anthropic",
    tier: "best",
    blurb: "Best overall accuracy. Best at structured shape extraction.",
    approxCostPerPage: "~$0.05",
  },
  {
    id: "anthropic/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    tier: "cheap-fast",
    blurb: "Same family, ~5x cheaper, ~2x faster. Quality dips on grainy aerials.",
    approxCostPerPage: "~$0.01",
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    provider: "OpenAI",
    tier: "best-alt",
    blurb: "OpenAI flagship. Different visual reasoning style. Use as a tiebreaker.",
    approxCostPerPage: "~$0.05",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    tier: "cheapest",
    blurb: "Cheapest reasonable option. Fastest in this list. Good for dry runs.",
    approxCostPerPage: "~$0.005",
  },
];

export const DEFAULT_VISION_MODEL_ID = VISION_MODELS[0].id;

export function findVisionModel(id: string): VisionModelChoice | undefined {
  return VISION_MODELS.find((m) => m.id === id);
}
