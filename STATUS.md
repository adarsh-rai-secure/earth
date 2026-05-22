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
