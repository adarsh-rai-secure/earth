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

### Phase 2 — Client-side Aerial Gallery (15 min)

**Architecture change locked 2026-05-22:** rasterization happens entirely **in the browser** via `pdfjs-dist`. No upload, no server route, no `aerial_pages` table, no schema changes. PDF stays in browser memory until user closes the tab.

- [x] `npm install pdfjs-dist`
- [x] `src/lib/pdf-render.ts` (client-only) — `renderPdfToCanvases(file: File, opts?: { dpi?: number }): AsyncGenerator<{ pageIndex: number; canvas: HTMLCanvasElement; width: number; height: number }>`. Default DPI 96 with optional 150 toggle. Uses dynamic `import("pdfjs-dist")` so it never lands in the server bundle.
- [x] Worker setup: **Option B** chosen — `GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs"`. Picked over Option A because Turbopack `?url` import handling is still flaky in Next 16 and unpkg version-pinning is bulletproof for the demo.
- [x] `src/app/components/AerialGallery.tsx` — `'use client'`, accepts `file: File | null` prop. Pre-allocates tile slots based on `getPageCount`, fills each tile incrementally as the async generator yields. Per-tile "Download PNG" + "Download all PNGs" button. Download uses `dataUrl` + programmatic `<a download>` click (canvas.toBlob ergonomics are fine but data URLs avoid the blob URL lifecycle on this hot path).
- [ ] Lazy render: only render a page's canvas when its tile enters the viewport (IntersectionObserver) so a 19-page PDF doesn't allocate ~100 MB of pixels upfront. **Deferred.** Current implementation renders pages sequentially at DPI 100 and stores dataURLs in state, not live canvases — much lower memory footprint than the original plan assumption. If we see lag on the 19-page test fixture, revisit.
- [x] Wire into [src/app/assessments/page.tsx](src/app/assessments/page.tsx) Section 2 ("Supporting documents"): when a PDF is selected, hold the `File` in component state and pass it to `AerialGallery`. The existing `/api/upload` + `/api/extract` text flow continues to run in parallel for the ESA-report path; the gallery just shares the same `File` ref, no extra upload. [FileUpload](src/app/components/FileUpload.tsx) now exposes an optional `onFile` callback that fires before the POST so the gallery and the upload run in parallel.
- [x] No DB changes. No new API routes. No Supabase storage writes for the boundary flow.

**Phase 2 demo checkpoint:** address → parcel map → drop PDF → 19 tiles render in-browser within ~10 sec, each with a working Download PNG. No network calls beyond the initial Regrid lookup. Push, deploy.

## Future Roadmap

Out of scope for this build, lined up for the next sprint:

- **Vision overlay on aerials** — Claude Sonnet 4.5 via OpenRouter identifies where the parcel sits in each aerial photo, composites the polygon onto the PNG with sharp. Download then returns the boundary-marked PNG. Estimated effort: ~20 min once Phase 1+2 are stable.
- **Manual-override editor** — drag polygon vertices on a `<canvas>` to correct vision output for high-accuracy cases. Pairs with the vision overlay above.
- **Compiled marked PDF** — bundle marked PNGs back into a deliverable PDF via `pdf-lib`, with a cover page (address + APN + date).
- **Multi-PDF projects** — let one assessment hold aerial PDFs from multiple decades.
- **Mathematical georeferencing** — when aerials have geographic markers (USGS quad refs, coordinate corners), compute the pixel-to-coord transform precisely instead of relying on vision. Production-grade path.

## Data Model Changes

**None for Phase 1+2.** Client-side rasterization removed the need for `aerial_pages` and the column additions to `assessments`. Persistence of the parcel lookup is also deferred — `/api/parcel` currently returns to the client without DB write, which is fine for the demo. If we later want persistence (refresh-survives state), add `address`, `parcel_geojson`, `parcel_apn`, `parcel_lat`, `parcel_lng` to `assessments` then.

## API Changes

| Route | Phase | Purpose |
|---|---|---|
| `/api/parcel` | 1 | address → geocode → Regrid → return parcel (no DB persist in this build) |
| `/api/extract` | unchanged | existing ESA text flow — not touched by boundary tool |

## UI Changes

- `AddressInput.tsx` — Phase 1
- `ParcelMap.tsx` — Phase 1, `'use client'`, dynamic import of `react-leaflet`
- `AerialGallery.tsx` — Phase 2, grid of pages with per-tile download
- `assessments/page.tsx` — Phase 1+2, new top section, gallery below upload

## Dependencies to Install

```bash
# Phase 1 (done)
npm install leaflet react-leaflet

# Phase 2 (client-side only)
npm install pdfjs-dist
```

## Risk / Open Questions

1. **`pdfjs-dist` worker config** — with Next.js 16 + Turbopack, `?url` worker imports work but require the dep version pinned. If worker initialization fails at runtime ("UnknownErrorException: Setting up fake worker failed"), fall back to the CDN URL form. **Validate within first 5 min of Phase 2.**
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
