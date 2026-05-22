// Best-effort extraction of subject-property address candidates from PDF page text.
// Aerial PDFs often have a cover/index page that says "Site Address: 1423 Prospect Avenue, ...".

const STREET_TYPES =
  "Avenue|Ave|Street|St|Road|Rd|Boulevard|Blvd|Drive|Dr|Way|Place|Pl|Terrace|Lane|Ln|Parkway|Pkwy|Plaza|Pz|Court|Ct|Highway|Hwy";

const LABELED_RE = new RegExp(
  "(?:Site\\s+Address|Subject\\s+Property\\s+Address|Property\\s+Address|Address)\\s*[:\\-]?\\s*([^\\n]{8,160}?)(?=\\s{2,}|\\s*(?:Coordinates|Latitude|Total\\s+Images|Imagery|Page|Date|\\n)|$)",
  "gi"
);

const STREET_RE = new RegExp(
  `\\b\\d{1,5}\\s+[A-Z][A-Za-z'\\.-]+(?:\\s+[A-Z][A-Za-z'\\.-]+){0,3}\\s+(?:${STREET_TYPES})\\b(?:,?\\s+[A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+)?)?(?:,?\\s+[A-Z]{2})?(?:\\s+\\d{5})?`,
  "g"
);

function cleanCandidate(raw: string): string {
  return raw
    .replace(/^[\s:,\-]+|[\s:,\-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausible(s: string): boolean {
  if (s.length < 8 || s.length > 180) return false;
  if (!/\d/.test(s)) return false;
  if (!/[A-Za-z]{3,}/.test(s)) return false;
  return true;
}

type Hit = { display: string; score: number; firstSeen: number };

export function extractAddressCandidates(pageTexts: string[]): string[] {
  const hits = new Map<string, Hit>();
  let n = 0;

  const bump = (raw: string, weight: number) => {
    const display = cleanCandidate(raw);
    if (!isPlausible(display)) return;
    const key = display.toLowerCase();
    const prev = hits.get(key);
    if (prev) {
      prev.score += weight;
    } else {
      hits.set(key, { display, score: weight, firstSeen: n++ });
    }
  };

  for (const text of pageTexts) {
    if (!text) continue;
    for (const m of text.matchAll(LABELED_RE)) bump(m[1] ?? "", 3);
    for (const m of text.matchAll(STREET_RE)) bump(m[0] ?? "", 1);
  }

  return Array.from(hits.values())
    .sort((a, b) => b.score - a.score || a.firstSeen - b.firstSeen)
    .map((h) => h.display)
    .slice(0, 5);
}
