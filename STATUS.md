# STATUS — Live Cross-Instance Log

> Append-only log so all four Claude Code instances (plan / build / test / observe) stay aligned. Read this and [PLAN.md](PLAN.md) at the start of every turn. Add one line per meaningful action.

Format: `YYYY-MM-DD HH:MM | <role> | <action>` — sort newest at the bottom.

## Active Instances

| Role | Working dir | Touches | Avoid |
|---|---|---|---|
| plan | `d:/projects/earth` | `PLAN.md`, `STATUS.md`, `docs/`, `KICKOFF_GUIDE.md`, root markdown | `src/`, `.gitignore`, `supabase/`, `.env.local` (no writes without ask) |
| build | `d:/projects/earth` | `src/`, `supabase/schema.sql`, `package.json`, `.gitignore`, deployment | `PLAN.md` body (only checkboxes), `STATUS.md` |
| test | `d:/projects/earth` | new `__tests__/`, `vitest.config.ts`, CI configs | feature code, schema |
| observe | `d:/projects/earth` | read-only — chat answers only | everything write |

## Coordination Rules

1. **Read first, write second.** Every turn, grep this file's tail and `git status` before acting.
2. **One checkbox at a time.** When a build step lands, tick it in `PLAN.md` and add a STATUS line.
3. **Lock notices.** If you're about to do a long-running operation on a file (e.g. `npm install`, schema migration, large refactor), append `LOCK: <path or system>` here first, then `UNLOCK: ...` when done.
4. **Failures get logged.** If a phase blocks, add `BLOCKER: <phase> — <reason>` so the plan agent can re-plan.
5. **No silent reverts.** Never delete another instance's file without an `OVERRIDE: <reason>` line here.

## Log

2026-05-22 15:08 | scaffold | initial earth/ scaffold present — Next.js 16, .claude/commands, src/lib + src/app/api wired
2026-05-22 ~16:00 | build | started Vercel link (added redundant `.vercel` to .gitignore)
2026-05-22 ~16:14 | build | replaced docs/ contents with `labeled_aerials.pdf` (37 MB, 19 pages) as the working input
2026-05-22 16:25 | plan | imported KICKOFF_GUIDE.md, created agents/ duplicate, populated docs/ (later curated by build)
2026-05-22 16:45 | plan | wrote PLAN.md v1 for property-boundary-image-markup feature; STATUS.md established as coordination log
2026-05-22 17:00 | plan | re-planned: user clarified this is a 1-hour interview build per [files/SCAFFOLD_PROMPT_V2.md](files/SCAFFOLD_PROMPT_V2.md). PLAN.md v2 reshaped around 3 phases (Regrid preview → side-by-side gallery → optional vision overlay).
2026-05-22 17:00 | plan | locked decisions: type-address parcel lookup; side-by-side only for Phase 1-2 (no overlay on aerial); per-page PNG download; one PDF per project; reuse existing `documents`/`assessments` schema + add `aerial_pages` table + 5 columns on `assessments`.
2026-05-22 17:00 | plan | flagged tension: user's original "every image with new boundaries drawn" implies vision overlay; locked path is side-by-side only. Phase 3 stretch covers the drawn-overlay output if build moves fast.
2026-05-22 17:15 | plan | user confirmed: NO overlay in this build. Phase 3 moved entirely to Future Roadmap section in PLAN.md. Build scope is now strictly Phase 1 + Phase 2.
2026-05-22 17:15 | plan | test fixture locked: address `1423 Prospect Avenue, Bronx, New York 10456` / coords `40.832862, -73.896752` / PDF `docs/labeled_aerials.pdf`. Use these for all manual smoke tests.
2026-05-22 17:15 | plan | renamed env var `Regrid_API_Key` → `REGRID_API_TOKEN` in `.env.local` to match V2 scaffold convention. All 5 keys now canonical. Still needs to be set in Vercel.
2026-05-22 17:30 | plan | **git→Vercel pipeline audit GREEN**: origin = `github.com/adarsh-rai-secure/earth.git`; Vercel project = `prj_9epY7UZARuoAYQVhFk3r32OdiI4p` (team `team_I7kxYjtGa2idqvGK0FjUz9Di`, scope `adarshrai348-1215s-projects`); live URL `https://earth-rouge.vercel.app/` returns 200; `/api/health` reports all 4 existing env vars set, supabase tables + uploads bucket OK, openrouter reachable. Push to main auto-deploys.
2026-05-22 17:30 | plan | Vercel MCP token I have is scoped to a different team and gets 403 on this project — build instance must run `vercel env add REGRID_API_TOKEN production preview development` from terminal (vercel-link already worked, see `.vercel/project.json`).
2026-05-22 17:30 | plan | **task for test instance**: write `__tests__/health.live.test.ts` that hits `https://earth-rouge.vercel.app/api/health` and asserts `ok:true` + every key under `env` + every nested `checks.*.ok` is true. Also add a unit-level supabase round-trip test (insert into `documents` with the service role key, read back, delete) to catch URL/anon-key regressions before deploy. /api/health already confirms supabase URL + anon key are real in prod.
2026-05-22 17:30 | plan | pending before first Phase-1 deploy: (a) `REGRID_API_TOKEN` added to Vercel env (build instance, via CLI), (b) my untracked `PLAN.md`/`STATUS.md`/`files/`/`docs/labeled_aerials.pdf` committed and pushed — leaving that commit decision to the build instance to avoid stepping on their working tree.
2026-05-22 18:05 | build | Phase 1 code landed: leaflet + @types/leaflet + @types/geojson installed; src/lib/regrid.ts (point + address lookup, robust parsing); src/lib/geocode.ts (Nominatim w/ User-Agent); /api/parcel POST route (point lookup w/ address fallback, no DB persist yet); AddressInput + ParcelMap (direct leaflet via useEffect, dynamic-imported in /assessments via next/dynamic ssr:false); /assessments restructured into "1. Subject property" + "2. Supporting documents" sections. typecheck + build clean. REGRID_API_TOKEN set in Vercel prod+dev (user-authorized).
2026-05-22 18:30 | plan | **Phase 2 architecture swap to client-side rasterization** (user-requested for speed). pdfjs-dist runs in browser, no upload, no `@napi-rs/canvas`, no `aerial_pages` table, no schema changes, no new API routes. PDF stays in-memory in browser; download = canvas.toBlob → URL.createObjectURL. Updated PLAN.md Phase 2 + Data Model + API Changes + Dependencies + Risks. Build instance needs only `npm install pdfjs-dist` and one new client component (`AerialGallery.tsx`) + one lib (`pdf-render.ts`).
2026-05-22 18:30 | plan | dep audit complete: all Phase 1 deps installed. Only missing dep for Phase 2 = `pdfjs-dist`. `@napi-rs/canvas` and `sharp` no longer needed (sharp was Phase 3 stretch which is in Future Roadmap anyway).
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
