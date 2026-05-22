# Build Plan: Parcel Boundary Tool (1-hour interview build)

> Single source of truth for all four instances. Read [STATUS.md](STATUS.md) for the live log. Tick checkboxes here as work lands; append a STATUS line when you do.

## Objective

A single-page tool where a consultant **(1) types an address**, **(2) sees that property's parcel boundary on a live Regrid-powered preview map**, **(3) uploads a multi-page aerial PDF**, and **(4) gets a side-by-side gallery — each rendered aerial page next to the Regrid parcel — with a per-page PNG download.** Drawing the boundary directly onto each aerial image is **out of scope for this build** — see [Future Roadmap](#future-roadmap).

## Approach

Two locked phases. Each ends with the app building, deployable, and demonstrably better than the previous one.

- **Phase 1 — Regrid preview window** (15 min): Address input + Nominatim geocode + Regrid lookup + Leaflet map with the parcel polygon drawn. This is the "wow moment" — type an address, watch the boundary appear in seconds.
- **Phase 2 — PDF upload + side-by-side gallery** (20 min): Upload aerial PDF, render each page to PNG server-side, store in Supabase, display gallery where each page renders alongside the Regrid map. Per-page PNG download button.

Schema decision left to builder: **either** add `projects` + `aerial_pages` tables (V2 scaffold convention) **or** reuse existing `assessments` + create one `aerial_pages` table linked to `documents`. The latter is faster — keep extract/generate routes intact, just add the rasterization step. **Recommendation: reuse existing.**

## Locked Decisions (from /plan intake)

| Decision | Choice |
|---|---|
| Parcel selection UX | Type address → Nominatim geocode → Regrid by point → auto-load on map. No click-to-select. |
| Overlay on aerials | **Out of scope.** Side-by-side display only. Drawing the boundary onto each aerial PNG is in [Future Roadmap](#future-roadmap). |
| Output format | Individual PNG download per page. No ZIP, no compiled PDF. |
| PDFs per project | One PDF per project. Simpler state, less UI. |
| Regrid token | ✅ Set in `.env.local` as `REGRID_API_TOKEN` (renamed from `Regrid_API_Key` on 2026-05-22). Still needs to land in Vercel env vars. |
| Manual-override editor | Out of scope. Punt to a later build. |
| Schema | Extend existing — add `aerial_pages` table linked to `documents`. Add `address`, `parcel_geojson`, `parcel_apn`, `parcel_lat`, `parcel_lng` columns to `assessments`. |
| Test fixture | Address: `1423 Prospect Avenue, Bronx, New York 10456`, Coords: `40.832862, -73.896752`, PDF: [docs/labeled_aerials.pdf](docs/labeled_aerials.pdf) (19 pages, 37 MB). |

## Phases

### Phase 1 — Regrid Preview Window (15 min)
- [x] `npm install leaflet react-leaflet` (no `@types/leaflet` — bundled types now)
- [x] [.env.local](.env.local) + [.env.example](.env.example) + Vercel: add `REGRID_API_TOKEN`
- [x] `src/lib/regrid.ts`:
  - [x] `lookupByAddress(address: string)` → calls `https://app.regrid.com/api/v2/parcels/address?query=...&token=...`
  - [x] `lookupByPoint(lat, lng)` → calls `.../parcels/point?lat=...&lon=...&token=...`
  - [x] Both return parsed `{ feature: GeoJSON.Feature, apn, acreage, addressNormalized }`
  - [x] On `REGRID_API_TOKEN` missing: throw a clean error so the UI can surface it
- [x] `src/lib/geocode.ts` → `geocodeAddress(address)` using Nominatim (`https://nominatim.openstreetmap.org/search`). Set `User-Agent: earth-amaearth-build/1.0 (https://earth-rouge.vercel.app)` (Nominatim requires it).
- [x] `src/app/api/parcel/route.ts` — POST `{ address }` → geocode → Regrid → return `{ parcel, coordinates, addressNormalized }`. Persist to `assessments` (create row if none exists for the session, or accept `assessmentId`).
- [x] `src/app/components/AddressInput.tsx` — controlled text field + "Look up parcel" button.
- [x] `src/app/components/ParcelMap.tsx` — `'use client'`, dynamic-import `react-leaflet` to avoid SSR issues. Renders OSM tiles + GeoJSON polygon. Fit-bounds to the parcel.
- [x] Wire into [src/app/assessments/page.tsx](src/app/assessments/page.tsx) **above** the existing upload flow. New top section: address input on the left, parcel map on the right.

**Phase 1 demo checkpoint:** type an address → see the parcel polygon on a Leaflet map. Push, deploy, screenshot.

### Phase 2 — PDF Upload + Side-by-Side Gallery (20 min)
- [ ] `npm install pdfjs-dist @napi-rs/canvas` for server-side rasterization
- [ ] `src/lib/rasterize.ts` → `rasterizePdfPages(buffer, opts?: { dpi?: number })` returns `{ pageIndex, png, width, height }[]`. Cap DPI 150.
- [ ] Add table:
  ```sql
  CREATE TABLE IF NOT EXISTS aerial_pages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    page_index INT NOT NULL,
    original_path TEXT NOT NULL,
    marked_path TEXT,
    width INT,
    height INT,
    overlay_polygon JSONB,
    status TEXT DEFAULT 'rasterized',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(document_id, page_index)
  );
  ALTER PUBLICATION supabase_realtime ADD TABLE aerial_pages;
  ALTER TABLE aerial_pages ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "demo_aerial_pages_all" ON aerial_pages FOR ALL USING (true) WITH CHECK (true);
  ```
- [ ] Add columns to `assessments`: `address TEXT`, `parcel_geojson JSONB`, `parcel_apn TEXT`, `parcel_lat DOUBLE PRECISION`, `parcel_lng DOUBLE PRECISION` (use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- [ ] Modify [src/app/api/extract/route.ts](src/app/api/extract/route.ts) to **also** rasterize each page, upload to `uploads/<docId>/page-<n>.png`, insert `aerial_pages` rows.
- [ ] `src/app/api/pages/route.ts` — GET `?documentId=...` → returns `aerial_pages` rows with signed URLs.
- [ ] `src/app/components/AerialGallery.tsx` — grid of pages. Each tile = aerial PNG on left, mini Regrid map on right (or shared global map). Per-tile "Download PNG" button (just `<a download>` to the signed URL).
- [ ] Plumb in [src/app/assessments/page.tsx](src/app/assessments/page.tsx) below the upload zone. After upload + extract, gallery populates.

**Phase 2 demo checkpoint:** address → parcel map → upload PDF → 19 tiles render with parcel map alongside, each downloadable. Push, deploy.

## Future Roadmap

Out of scope for this build, lined up for the next sprint:

- **Vision overlay on aerials** — Claude Sonnet 4.5 via OpenRouter identifies where the parcel sits in each aerial photo, composites the polygon onto the PNG with sharp. Download then returns the boundary-marked PNG. Estimated effort: ~20 min once Phase 1+2 are stable.
- **Manual-override editor** — drag polygon vertices on a `<canvas>` to correct vision output for high-accuracy cases. Pairs with the vision overlay above.
- **Compiled marked PDF** — bundle marked PNGs back into a deliverable PDF via `pdf-lib`, with a cover page (address + APN + date).
- **Multi-PDF projects** — let one assessment hold aerial PDFs from multiple decades.
- **Mathematical georeferencing** — when aerials have geographic markers (USGS quad refs, coordinate corners), compute the pixel-to-coord transform precisely instead of relying on vision. Production-grade path.

## Data Model Changes

- New `aerial_pages` table (see Phase 2 SQL).
- `assessments` gets 5 new columns (`address`, `parcel_geojson`, `parcel_apn`, `parcel_lat`, `parcel_lng`).
- No changes to `documents` table.

## API Changes

| Route | Phase | Purpose |
|---|---|---|
| `/api/parcel` | 1 | address → geocode → Regrid → write to `assessments` |
| `/api/extract` | 2 (modified) | also rasterizes pages → `aerial_pages` rows |
| `/api/pages` | 2 | list pages with signed PNG URLs for the gallery |

## UI Changes

- `AddressInput.tsx` — Phase 1
- `ParcelMap.tsx` — Phase 1, `'use client'`, dynamic import of `react-leaflet`
- `AerialGallery.tsx` — Phase 2, grid of pages with per-tile download
- `assessments/page.tsx` — Phase 1+2, new top section, gallery below upload

## Dependencies to Install

```bash
# Phase 1
npm install leaflet react-leaflet

# Phase 2
npm install pdfjs-dist @napi-rs/canvas
```

## Risk / Open Questions

1. **PDF rasterization on Vercel** — `pdfjs-dist` + `@napi-rs/canvas` together can push the bundle past Vercel's 50 MB serverless limit. If it breaks: fall back to client-side rendering with `react-pdf` (render in-browser, upload PNGs from the client) or push rasterization to a single dedicated route with the Node runtime and lazy imports. **Validate within first 5 min of Phase 2.**
2. **Nominatim rate limit** — free tier is 1 req/sec, must include `User-Agent`. For one-off demo lookups this is fine.
3. **`react-leaflet` SSR** — Leaflet touches `window` on import. Must use `next/dynamic` with `ssr: false` for `ParcelMap`.
4. **Address mismatch** — if Nominatim geocodes to the wrong place, Regrid returns a wrong parcel. Mitigation: show the geocoded address in the UI ("Found: 123 Main St, City, ST") and a "wrong address?" link that re-runs with a more specific query.
5. **Regrid token missing during demo** — fallback path: hardcode a single GeoJSON polygon for the `labeled_aerials.pdf` property, gated on `REGRID_API_TOKEN === ""`. Build the fallback in Phase 1 as a 2-minute safety net.
## Definition of Done

- [ ] Live URL on Vercel loads the new tool page
- [ ] Type `1423 Prospect Avenue, Bronx, New York 10456` → parcel polygon renders on a Leaflet map within ~3 seconds
- [ ] Upload [docs/labeled_aerials.pdf](docs/labeled_aerials.pdf) → all 19 pages render as PNG tiles next to the parcel map
- [ ] Per-page "Download PNG" works for every tile
- [ ] No console errors during a full happy-path run
- [ ] Every commit is on `main`, descriptive, Vercel auto-deploys cleanly
- [ ] `REGRID_API_TOKEN` set in Vercel env vars (Production + Preview + Development)

## Cross-Instance Protocol

Before any write: read [STATUS.md](STATUS.md) tail and run `git status` to make sure you don't collide with another instance. When you finish a checkbox here, append a one-line STATUS entry. If you hit a blocker, add `BLOCKER: <phase> — <reason>` so the plan agent (this chat) can re-plan.
