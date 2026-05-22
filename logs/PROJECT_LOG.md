# Earth — Project Log

Consolidated history of every action taken in `d:/projects/earth` between scaffold init and the latest commit. Generated 2026-05-22.

- **Repo:** https://github.com/adarsh-rai-secure/earth.git
- **Branch:** `main` (only branch; tracking `origin/main`, clean tree)
- **Live URL:** https://earth-rouge.vercel.app/
- **Vercel project:** `prj_9epY7UZARuoAYQVhFk3r32OdiI4p` (team `team_I7kxYjtGa2idqvGK0FjUz9Di`)
- **Purpose:** 1-hour live coding interview build with Isiah Cruz, CEO of AMA Earth Group — emulates "Squid" (AI Phase I ESA report generation).

---

## 1. Commit Timeline (oldest → newest)

All 13 commits on `main`, author `adarsh-rai-secure <adarsh_rai@outlook.com>`.

| # | Time (ET) | SHA | Files | +/− | Subject |
|---|-----------|-----|-------|-----|---------|
| 1 | 15:13 | `f3f5a9f` | 40 | +8918 | feat: initial scaffold (Next.js 16 + Tailwind v4 + Supabase + OpenRouter, AMA Earth UI clone, /assessments demo pipeline) |
| 2 | 15:45 | `564b9ac` | 12 | +1458 | feat(api): add /api/health diagnostic endpoint (env + supabase tables + uploads bucket + openrouter ping) |
| 3 | 15:47 | `62e7846` | 5 | +632 | feat(demo): /demo page with one-click pipeline runner (3 sample PDFs in public/samples/) |
| 4 | 15:55 | `6c2b191` | 8 | +155/−229 | fix(extract): downgrade pdf-parse to v1.1.1 (resolves DOMMatrix not defined on Vercel serverless); feat(ui): model selector with 6 OpenRouter models on /assessments and /demo |
| 5 | 15:57 | `6370666` | 1 | +2/−2 | fix(openrouter): replace em-dash in X-Title header with ASCII hyphen (HTTP headers must be ByteString) |
| 6 | 16:44 | `0743955` | 18 | +968/−781 | feat(phase1): Regrid parcel preview — address input + Nominatim geocode + Regrid v2 lookup + Leaflet map on /assessments |
| 7 | 16:54 | `7eb1893` | 11 | +733/−42 | feat(phase2): client-side aerial gallery (pdfjs-dist in browser, no server route, per-page + bulk PNG download) |
| 8 | 17:05 | `23f9207` | 3 | +65/−21 | fix(upload): direct browser to Supabase upload, bypass Vercel 4.5MB limit |
| 9 | 17:12 | `6e456b1` | 2 | +60/−146 | fix(assessments): strip ESA text pipeline + server upload from /assessments; aerial drop-zone goes straight to client-side gallery |
| 10 | 17:58 | `b4894f8` | 17 | +107/−1183 | chore(phaseA): rip out /demo + ESA text pipeline + unused components; v3 boundary-overlay roadmap committed |
| 11 | 18:02 | `8a950f8` | 7 | +499/−62 | feat(boundary-overlay): vision model marks parcel polygon on each aerial PNG (Claude Sonnet 4.5 via OpenRouter, parallel-4, client-side canvas composite); per-page text chip from pdfjs text layer |
| 12 | 18:13 | `995508d` | 1 | +15/−4 | fix(regrid): unwrap 'parcels' key in FeatureCollection response |
| 13 | 18:16 | `9ed8e2c` | 2 | +113 | test: add __tests__/mark.live.mjs covering /api/parcel + /api/mark validation + happy path |

**Totals:** 13 commits, ~13,743 lines added, ~2,470 lines removed across the day.

---

## 2. Per-Commit File Changes

### 1 · `f3f5a9f` — Initial scaffold
Added: `.claude/commands/{observe,plan,review,test}.md`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `ESA_DOMAIN.md`, `README.md`, `eslint.config.mjs`, `next.config.ts`, `package-lock.json`, `package.json`, `postcss.config.mjs`, `public/{file,globe,next,vercel,window}.svg`, `src/app/api/{extract,generate,upload}/route.ts`, `src/app/assessments/page.tsx`, `src/app/components/{BenefitsRow,FeatureTriad,FileUpload,FooterBar,Hero,Navbar,ProcessingStatus,ReportViewer}.tsx`, `src/app/favicon.ico`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/{extract,openrouter,supabase}.ts`, `supabase/schema.sql`, `tsconfig.json`.

### 2 · `564b9ac` — /api/health + agents
Added: `KICKOFF_GUIDE.md`, `agents/{observe,plan,review,test}.md`, `docs/{aerial-maps,city-directory,database-report,environmental-report,physical-setting}-sample.pdf`, `src/app/api/health/route.ts`. Modified: `.gitignore`.

### 3 · `62e7846` — /demo page
Added: `public/samples/{city-directory,database-report,environmental-report}-sample.pdf`, `src/app/demo/page.tsx`, `test-fixtures/probe.pdf`.

### 4 · `6c2b191` — pdf-parse downgrade + model picker
Added: `src/app/components/ModelPicker.tsx`, `src/lib/models.ts`, `src/types/pdf-parse-internal.d.ts`. Modified: `package.json`, `package-lock.json`, `src/app/assessments/page.tsx`, `src/app/demo/page.tsx`, `src/lib/extract.ts`.

### 5 · `6370666` — em-dash fix
Modified: `src/lib/openrouter.ts`.

### 6 · `0743955` — Phase 1 (Regrid)
Added: `PLAN.md`, `STATUS.md`, `docs/labeled_aerials.pdf` (37 MB), `files/{CLAUDE_v2,SCAFFOLD_PROMPT_V2}.md`, `src/app/api/parcel/route.ts`, `src/app/components/{AddressInput,ParcelMap}.tsx`, `src/lib/{geocode,regrid}.ts`. Removed: 5 sample PDFs from `docs/`. Modified: `package.json`, `package-lock.json`, `src/app/assessments/page.tsx`.

### 7 · `7eb1893` — Phase 2 (client-side gallery)
Added: `__tests__/{README.md,health.live.mjs,supabase-roundtrip.mjs}`, `src/app/components/AerialGallery.tsx`, `src/lib/pdf-render.ts`. Modified: `PLAN.md`, `STATUS.md`, `package.json`, `package-lock.json`, `src/app/assessments/page.tsx`, `src/app/components/FileUpload.tsx`.

### 8 · `23f9207` — Direct browser→Supabase upload
Modified: `STATUS.md`, `src/app/api/upload/route.ts`, `src/app/components/FileUpload.tsx`.

### 9 · `6e456b1` — Strip ESA pipeline from /assessments
Modified: `STATUS.md`, `src/app/assessments/page.tsx`.

### 10 · `b4894f8` — Phase A rip-out
Added: `ROADMAP_v3.md`. Modified: `STATUS.md`, `package.json`, `package-lock.json`. Removed: `public/samples/{city-directory,database-report,environmental-report}-sample.pdf`, `src/app/api/{extract,generate}/route.ts`, `src/app/components/{FileUpload,ModelPicker,ProcessingStatus,ReportViewer}.tsx`, `src/app/demo/page.tsx`, `src/lib/{extract,models}.ts`, `src/types/pdf-parse-internal.d.ts`.

### 11 · `8a950f8` — Vision boundary overlay
Added: `src/app/api/mark/route.ts`, `src/lib/{canvas-mark,openrouter-vision}.ts`. Modified: `STATUS.md`, `src/app/assessments/page.tsx`, `src/app/components/AerialGallery.tsx`, `src/lib/pdf-render.ts`.

### 12 · `995508d` — Regrid parser fix
Modified: `src/lib/regrid.ts`.

### 13 · `9ed8e2c` — Live tests for /api/parcel + /api/mark
Added: `__tests__/mark.live.mjs`. Modified: `STATUS.md`.

---

## 3. Cross-Instance Activity Log (verbatim from STATUS.md)

This is the append-only coordination log used by the four parallel Claude Code instances (plan / build / test / observe) per the multi-agent protocol.

```
2026-05-22 15:08 | scaffold | initial earth/ scaffold present — Next.js 16, .claude/commands, src/lib + src/app/api wired
2026-05-22 ~16:00 | build | started Vercel link (added redundant `.vercel` to .gitignore)
2026-05-22 ~16:14 | build | replaced docs/ contents with `labeled_aerials.pdf` (37 MB, 19 pages) as the working input
2026-05-22 16:25 | plan | imported KICKOFF_GUIDE.md, created agents/ duplicate, populated docs/ (later curated by build)
2026-05-22 16:45 | plan | wrote PLAN.md v1 for property-boundary-image-markup feature; STATUS.md established as coordination log
2026-05-22 17:00 | plan | re-planned: user clarified this is a 1-hour interview build per files/SCAFFOLD_PROMPT_V2.md. PLAN.md v2 reshaped around 3 phases (Regrid preview → side-by-side gallery → optional vision overlay).
2026-05-22 17:00 | plan | locked decisions: type-address parcel lookup; side-by-side only for Phase 1-2 (no overlay on aerial); per-page PNG download; one PDF per project; reuse existing documents/assessments schema + add aerial_pages table + 5 columns on assessments.
2026-05-22 17:00 | plan | flagged tension: user's original "every image with new boundaries drawn" implies vision overlay; locked path is side-by-side only. Phase 3 stretch covers the drawn-overlay output if build moves fast.
2026-05-22 17:15 | plan | user confirmed: NO overlay in this build. Phase 3 moved entirely to Future Roadmap section in PLAN.md. Build scope is now strictly Phase 1 + Phase 2.
2026-05-22 17:15 | plan | test fixture locked: address `1423 Prospect Avenue, Bronx, New York 10456` / coords `40.832862, -73.896752` / PDF `docs/labeled_aerials.pdf`. Use these for all manual smoke tests.
2026-05-22 17:15 | plan | renamed env var `Regrid_API_Key` → `REGRID_API_TOKEN` in `.env.local` to match V2 scaffold convention. All 5 keys now canonical. Still needs to be set in Vercel.
2026-05-22 17:30 | plan | git→Vercel pipeline audit GREEN: origin = github.com/adarsh-rai-secure/earth.git; Vercel project = prj_9epY7UZARuoAYQVhFk3r32OdiI4p (team team_I7kxYjtGa2idqvGK0FjUz9Di, scope adarshrai348-1215s-projects); live URL https://earth-rouge.vercel.app/ returns 200; /api/health reports all 4 existing env vars set, supabase tables + uploads bucket OK, openrouter reachable. Push to main auto-deploys.
2026-05-22 17:30 | plan | Vercel MCP token I have is scoped to a different team and gets 403 on this project — build instance must run `vercel env add REGRID_API_TOKEN production preview development` from terminal (vercel-link already worked, see .vercel/project.json).
2026-05-22 17:30 | plan | task for test instance: write __tests__/health.live.test.ts that hits https://earth-rouge.vercel.app/api/health and asserts ok:true + every key under env + every nested checks.*.ok is true. Also add a unit-level supabase round-trip test (insert into documents with the service role key, read back, delete) to catch URL/anon-key regressions before deploy.
2026-05-22 17:30 | plan | pending before first Phase-1 deploy: (a) REGRID_API_TOKEN added to Vercel env (build instance, via CLI), (b) my untracked PLAN.md/STATUS.md/files//docs/labeled_aerials.pdf committed and pushed — leaving that commit decision to the build instance to avoid stepping on their working tree.
2026-05-22 18:05 | build | Phase 1 code landed: leaflet + @types/leaflet + @types/geojson installed; src/lib/regrid.ts (point + address lookup, robust parsing); src/lib/geocode.ts (Nominatim w/ User-Agent); /api/parcel POST route (point lookup w/ address fallback, no DB persist yet); AddressInput + ParcelMap (direct leaflet via useEffect, dynamic-imported in /assessments via next/dynamic ssr:false); /assessments restructured into "1. Subject property" + "2. Supporting documents" sections. typecheck + build clean. REGRID_API_TOKEN set in Vercel prod+dev (user-authorized).
2026-05-22 18:30 | plan | Phase 2 architecture swap to client-side rasterization (user-requested for speed). pdfjs-dist runs in browser, no upload, no @napi-rs/canvas, no aerial_pages table, no schema changes, no new API routes. PDF stays in-memory in browser; download = canvas.toBlob → URL.createObjectURL. Updated PLAN.md Phase 2 + Data Model + API Changes + Dependencies + Risks. Build instance needs only `npm install pdfjs-dist` and one new client component (AerialGallery.tsx) + one lib (pdf-render.ts).
2026-05-22 18:30 | plan | dep audit complete: all Phase 1 deps installed. Only missing dep for Phase 2 = pdfjs-dist. @napi-rs/canvas and sharp no longer needed (sharp was Phase 3 stretch which is in Future Roadmap anyway).
2026-05-22 18:30 | plan | gotcha for build instance: pdfjs worker setup with Next 16 / Turbopack — prefer `import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url"` then `GlobalWorkerOptions.workerSrc = workerSrc`. Fallback = unpkg CDN URL. See PLAN.md Phase 2 for both options.
2026-05-22 19:55 | test | LOCK: __tests__/ — writing health.live.mjs + supabase-roundtrip.mjs per 17:30 assignment. Using node --test (no vitest install, leaves package.json to build).
2026-05-22 19:58 | test | UNLOCK: __tests__/ — added health.live.mjs (4 tests) + supabase-roundtrip.mjs (5 tests) + README. 9/9 green against earth-rouge.vercel.app + .env.local Supabase. Runs via `node --env-file=.env.local --test __tests__/*.mjs`. No new deps.
2026-05-22 18:18 | build | Phase 2 code landed (fully client-side per plan agent's revision): pdfjs-dist@5.7.284 installed; src/lib/pdf-render.ts (async generator using dynamic import + unpkg worker pinned to installed version); src/app/components/AerialGallery.tsx (pre-allocated tile slots, fills incrementally as generator yields, per-tile + bulk PNG download); FileUpload now accepts optional onFile callback so the gallery and the upload pipeline share the File ref without re-reading; AerialGallery wired into /assessments below the doc metadata row. typecheck + build clean. No DB writes, no API routes, no Supabase storage for the gallery flow.
2026-05-22 20:01 | test | OVERRIDE: src/app/components/FileUpload.tsx + src/app/api/upload/route.ts — user directed test instance to fix the 37MB-PDF 413 (FUNCTION_PAYLOAD_TOO_LARGE) blocking build. Refactoring to direct browser→Supabase upload (bypasses Vercel body limit), tiny /api/upload becomes metadata-only POST. Returns same response shape so /api/extract is unchanged.
2026-05-22 20:04 | test | UNLOCK src/ — direct browser→Supabase upload landed. FileUpload uses getSupabaseBrowser().storage.from("uploads").upload(); /api/upload now JSON-only metadata route ({storagePath,filename}→{documentId,filename,fileUrl,status}). 35.4MB labeled_aerials.pdf round-trips upload→extract→cleanup in ~6s locally. Validation: 400 on missing/malformed path, 404 on non-existent storage object. typecheck+build clean. 9/9 __tests__/ still green. Build instance: push to main when ready — Vercel side needs no env changes.
2026-05-22 18:35 | build | /assessments stripped to Phase 1+2 only per user fix request. REMOVED from this page: /api/extract + /api/generate calls, ProcessingStatus, ModelPicker, ReportViewer, DownloadJsonButton, all text-summary state. REMOVED the FileUpload component dependency (was doing direct-to-Supabase + /api/upload roundtrip that was failing). NEW: inline drop zone that emits the File straight to AerialGallery — pure browser, zero network calls beyond the initial Regrid lookup. /api/extract + /api/generate + the ESA text pipeline remain available on /demo for the original showcase.
2026-05-22 20:42 | build | ROADMAP_v3.md committed. v3 supersedes PLAN.md v2 per user direction. Core pivot: boundary polygon drawn ON each aerial PNG via vision model, not side-by-side gallery.
2026-05-22 20:42 | build | Phase A rip-out: removed /demo, /api/extract, /api/generate, FileUpload, ProcessingStatus, ReportViewer, ModelPicker, src/lib/extract.ts, src/lib/models.ts, src/types/pdf-parse-internal.d.ts, public/samples/. Uninstalled pdf-parse + @types/pdf-parse. Build clean. Routes: /, /assessments, /api/health, /api/parcel, /api/upload.
2026-05-22 20:55 | build | Phase B+C landed. NEW: src/lib/openrouter-vision.ts (markParcelInImage via Claude Sonnet 4.5 vision), src/lib/canvas-mark.ts (downsampleDataUrl + composeMarkedDataUrl client helpers), src/app/api/mark/route.ts. CHANGED: src/lib/pdf-render.ts also yields pageText from getTextContent(); src/app/components/AerialGallery.tsx rewritten with raw vs marked dataUrl, "Mark all N pages" button (parallel-4), per-tile "Mark"/"Re-mark", confidence + visible flag chips, page-text snippet chip; /assessments passes parcel into gallery. typecheck + build clean. Routes now: /, /assessments, /api/health, /api/mark, /api/parcel, /api/upload.
2026-05-22 21:25 | build | self-test (no more test agent — user direction): /api/parcel was 500 ('unexpected Regrid response shape') — Regrid v2 wraps FeatureCollection in `parcels` key; fixed parser to unwrap both shapes; deployed. Added __tests__/mark.live.mjs (4 tests: parcel returns polygon, /api/mark rejects missing imageDataUrl, rejects missing parcel, happy path with real OSM tile as image returns visible/confidence/pixelPolygon shape). Full sweep: 13/13 live tests green against earth-rouge.vercel.app. /assessments HTML SSR shows Subject property + Aerial photos sections, Look up parcel button, drop zone copy, Loading map placeholder. /api/mark verified: vision call to anthropic/claude-sonnet-4-5 returns ~3.5s for a 256x256 PNG, JSON shape matches MarkResult type.
```

---

## 4. Phase Summary

### Scaffold (commits 1–5)
Bootstrap of the AMA Earth lookalike: Next.js 16 App Router, Tailwind v4, Supabase tables + uploads bucket, OpenRouter wrapper, `/api/upload` + `/api/extract` + `/api/generate` text pipeline, `/assessments` UI, `/demo` one-click runner, `/api/health` diagnostic, 6-model picker. Two production fixes: pdf-parse downgrade to v1.1.1 (Vercel serverless DOMMatrix), em-dash → hyphen in `X-Title` header.

### Phase 1 — Regrid preview (commit 6)
Address input → Nominatim geocode → Regrid v2 lookup → Leaflet polygon. `src/lib/{regrid,geocode}.ts`, `/api/parcel`, `AddressInput`, `ParcelMap`. `REGRID_API_TOKEN` provisioned in Vercel prod+dev. Test fixture locked: 1423 Prospect Ave, Bronx + `docs/labeled_aerials.pdf` (37 MB, 19 pages).

### Phase 2 — Client-side aerial gallery (commits 7–9)
pdfjs-dist in-browser rasterization, no server route, no schema. `src/lib/pdf-render.ts` async generator, `AerialGallery.tsx` with per-tile + bulk PNG download. Mid-build pivot: 37 MB PDF hit Vercel's 4.5 MB function payload cap, so `FileUpload` was refactored to direct browser→Supabase upload with `/api/upload` reduced to a metadata-only JSON endpoint. Then `/assessments` was further stripped of the ESA text pipeline so the aerial drop-zone goes straight into the client gallery with zero network calls beyond the Regrid lookup.

### Phase v3 — Vision boundary overlay (commits 10–13)
ROADMAP_v3 pivot: vision model marks the parcel polygon directly **on** each aerial PNG. Phase A removed `/demo`, `/api/extract`, `/api/generate`, ESA pipeline components, `pdf-parse`, sample PDFs. Phase B+C added `src/lib/openrouter-vision.ts` (Claude Sonnet 4.5), `src/lib/canvas-mark.ts`, `/api/mark`, page text extraction. Self-test caught a Regrid v2 response-shape bug (`parcels` wrapper); fixed and shipped. `__tests__/mark.live.mjs` covers validation + happy path. 13/13 live tests green.

---

## 5. Current Repo State

- **Branch:** `main`, working tree clean, in sync with `origin/main`.
- **Live routes:** `/`, `/assessments`, `/api/health`, `/api/mark`, `/api/parcel`, `/api/upload`.
- **Active fixture:** address `1423 Prospect Avenue, Bronx, NY 10456` (40.832862, −73.896752), `docs/labeled_aerials.pdf`.
- **Coordination artifacts:** [PLAN.md](../PLAN.md), [STATUS.md](../STATUS.md), [ROADMAP_v3.md](../ROADMAP_v3.md), [KICKOFF_GUIDE.md](../KICKOFF_GUIDE.md), [agents/](../agents/).
- **Test suites:** [__tests__/health.live.mjs](../__tests__/health.live.mjs), [__tests__/supabase-roundtrip.mjs](../__tests__/supabase-roundtrip.mjs), [__tests__/mark.live.mjs](../__tests__/mark.live.mjs) — run via `node --env-file=.env.local --test __tests__/*.mjs`.

---

## 6. Open Items

- Definition-of-Done from [PLAN.md](../PLAN.md): demo-day walk-through against the live URL still needs a manual confirmation pass (type address → polygon → upload → marked tiles).
- [PLAN.md](../PLAN.md) is v2 (side-by-side); [ROADMAP_v3.md](../ROADMAP_v3.md) is the current source of truth for the vision-overlay direction. Consolidate or mark v2 as superseded.
