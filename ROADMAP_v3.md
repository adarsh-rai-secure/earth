# Roadmap v3 — Boundary Drawn ON Aerial PNGs

> Supersedes PLAN.md v2 per user direction 2026-05-22 ~20:30. Plan agent: integrate or replace v2.

## Objective

For each page of an uploaded aerial PDF: render to PNG in browser, then **draw the subject parcel polygon directly onto the PNG**, downloadable. The polygon's lat/lng shape comes from Regrid. The pixel position in each photo comes from a vision-language model (Claude Sonnet 4.5 via OpenRouter).

This is the entire product surface. /assessments is the only feature page. /demo and the ESA text-summary pipeline are removed.

## Where each piece lands

| Component | Status | Purpose |
|---|---|---|
| `/api/parcel` | Keep | Regrid lookup — source of authoritative parcel polygon |
| `/api/health` | Keep | Diagnostic for test agent |
| `/api/upload` (metadata route) | Keep | Test agent built it, useful elsewhere; not on /assessments |
| `/api/extract` | **Remove** | Was for ESA text pipeline. Not useful for boundary overlay. |
| `/api/generate` | **Remove** | ESA summary. Different product surface. |
| `/api/mark` | **New** | POST PNG + parcel polygon + address → vision model → returns normalized pixel polygon + confidence + visible flag |
| `/demo` | **Remove** | Was the ESA summary showcase. |
| `/assessments` | Rebuild | The boundary tool. Address → parcel → upload PDF → marked gallery. |
| `pdfjs-dist` text layer | Add | Per-page text extraction for sanity chip ("PDF says: 1948 NW 18th Terrace") |
| `pdf-parse` | **Remove** | Was for /api/extract. Drop entirely. |
| `FileUpload`, `ProcessingStatus`, `ReportViewer`, `ModelPicker` | **Remove** | All tied to the ESA pipeline. |
| `extract.ts`, `models.ts`, `pdf-parse-internal.d.ts` | **Remove** | Stale. |
| `public/samples/*` | **Remove** | Demo fixtures, no longer used. |

## Phases

### Phase A — Rip-out (5 min)
- Remove `/demo`, `/api/extract`, `/api/generate`, `FileUpload`, `ProcessingStatus`, `ReportViewer`, `ModelPicker`, `extract.ts`, `models.ts`, `pdf-parse-internal.d.ts`, `public/samples/`.
- `npm uninstall pdf-parse @types/pdf-parse`.
- Simplify `/api/health` to drop the Supabase storage bucket check that's now incidental (leave the Supabase + OpenRouter pings since both are still used).
- Verify build clean.

### Phase B — Vision Overlay (20 min)
- `src/lib/openrouter-vision.ts` — `markParcelInImage({ imageDataUrl, parcelPolygonLatLng, address, model? }): Promise<{ pixelPolygon: [number, number][]; visible: boolean; confidence: number; rationale: string }>`. Posts OpenAI-style `content: [{ type: "text" }, { type: "image_url", image_url: { url: dataUrl } }]`. Asks model to return strict JSON with **normalized 0..1 pixel coords** so we can rescale to the marked-up canvas size.
- `src/app/api/mark/route.ts` — POST `{ imageDataUrl, parcel, address }` → calls `markParcelInImage` → returns the response. Bounded body size (limit imageDataUrl to ~3 MB; downsample on client before send).
- `src/app/components/AerialGallery.tsx` updates:
  - Accept new prop: `parcel: ParcelLookupResult | null`, `onMarkAll?: () => void`.
  - "Mark all 19 pages" button at top, disabled until parcel is set and rendering finished. Parallel-4 fan-out to `/api/mark`.
  - Per-tile "Re-mark" button that calls `/api/mark` for just that page.
  - When mark response arrives for a tile: composite polygon onto a copy of the rendered canvas using `ctx.stroke`/`ctx.fill` (red 4px stroke, 20% red fill). Replace tile's dataUrl with the marked version. Show confidence chip + visible flag.
  - "Download PNG" downloads the **current** (marked or unmarked) version.
- Update `src/app/assessments/page.tsx` to pass `parcel` into `AerialGallery`.

### Phase C — PDF text snippet per page (5 min, optional polish)
- Extend `src/lib/pdf-render.ts` to also yield `pageText` from `page.getTextContent()`.
- Show small chip beneath each tile: `📄 "<first 100 chars>"`. Helps the demo viewer see "yes this aerial corresponds to 1972 NW 18th Terrace".

## Architecture summary

```
User types address ─► /api/parcel ─► Regrid polygon (lat/lng)
                                            │
User drops PDF ─► pdfjs-dist (client) ─► PNG + page text (per page)
                                            │
                              ┌─────────────┴──────────────┐
                              ▼                            ▼
                       Display unmarked tile         (when user clicks Mark)
                                                            │
                                                            ▼
                                          /api/mark { image, polygon, address }
                                                            │
                                                            ▼
                                          OpenRouter vision (Claude Sonnet 4.5)
                                                            │
                                                            ▼
                                          { pixelPolygon, visible, confidence }
                                                            │
                                                            ▼
                                          Client canvas composite → marked PNG
```

Zero Supabase writes. Zero server-side image manipulation. Vision model returns only coordinates; the compositing is client-side canvas math.

## Cost / time

- ~$0.04 per vision call × 19 pages = **~$0.76 per full mark-all**
- Parallel-4 → **~20-25s** to mark all 19 pages
- Per-tile re-mark = ~4s, ~$0.04

## Risks

1. **Vision can't find the parcel in some old aerials.** Surface `visible: false` + confidence. Tile shows unmarked PNG + explanation chip. No crash.
2. **Data URL request size.** A 1200×900 PNG @ DPI 100 is ~1.5 MB base64. Downsample to 1024px max side before sending to /api/mark (vision doesn't need full res anyway). Composite the polygon on the FULL-res canvas client-side after rescaling the response polygon.
3. **OpenRouter latency / rate limits.** Parallel-4, retry once on 429.
4. **Coord system.** Vision returns normalized 0..1 — robust to image rescaling. Polygon shape matters more than absolute pixel values.

## Definition of Done

- [ ] /assessments: type test address `1423 Prospect Avenue, Bronx, NY 10456` → parcel polygon on map within ~3s
- [ ] Drop `docs/labeled_aerials.pdf` → 19 unmarked tiles in ~10s with PDF text chips
- [ ] Click "Mark all 19 pages" → tiles fill with red boundary polygons over ~25s, confidence chips visible
- [ ] Per-tile "Re-mark" works
- [ ] "Download PNG" returns the marked version
- [ ] No /api/extract, /api/generate, /demo, FileUpload references in src/
- [ ] /api/health still ok:true
- [ ] No console errors

## Cross-instance notes

- Test agent: tests in `__tests__/supabase-roundtrip.mjs` that depended on `/api/extract` will break — please drop them or adapt. `health.live.mjs` should be fine. Consider adding a `mark.live.mjs` smoke test for the new endpoint.
- Plan agent: this roadmap supersedes PLAN.md v2. Merge or rewrite at your discretion.
