# `__tests__/`

Owned by the `test` instance (see [STATUS.md](../STATUS.md) Active Instances table).

Tests run on Node 24's built-in `node --test` runner — no `vitest`, no install needed. Keeps `package.json` ownership with the `build` instance.

## Run

```bash
# Hit the deployed Vercel URL (default earth-rouge.vercel.app)
node --test __tests__/health.live.mjs

# Override target — useful for pre-deploy checks against localhost
LIVE_URL=http://localhost:3000 node --test __tests__/health.live.mjs

# Supabase round-trip (needs .env.local creds)
node --env-file=.env.local --test __tests__/supabase-roundtrip.mjs

# All of them
node --env-file=.env.local --test __tests__/*.mjs
```

## What each test catches

| File | Catches |
|---|---|
| `health.live.mjs` | Vercel env-var drops; Supabase URL/key invalidation in prod; OpenRouter outage; stale deployment (timestamp older than 60s) |
| `supabase-roundtrip.mjs` | RLS demo policies removed; service-role key revoked; `documents` table schema drift; uploads bucket deleted or set public; orphaned probe-row leaks from prior crashes |

## Discipline

- Probe rows use prefix `__rt_probe_` so they're identifiable + cleanupable.
- `supabase-roundtrip.mjs` cleans up its own probe rows in `finally`, and sweeps any survivors from prior runs at the end.
- Don't add tests that touch storage uploads here — that requires real PDFs and bytes-out cost. Save those for a dedicated `__tests__/pipeline.live.mjs` if needed.
