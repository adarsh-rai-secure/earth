# Earth

Live build scaffold emulating AMA Earth's product surface for a Phase I ESA roadmap-item demo.

Stack: Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase · OpenRouter · Vercel.

## What's in the box

- **Homepage clone** of [amaearthgroup.com](https://amaearthgroup.com) (`/`)
- **Assessments demo surface** with a working PDF upload → text extraction → LLM report draft pipeline (`/assessments`)
- **API routes:** `/api/upload`, `/api/extract`, `/api/generate`
- **Supabase schema** at `supabase/schema.sql`
- **Four agent commands** at `.claude/commands/`: `/plan`, `/test`, `/review`, `/observe`
- **Domain reference** at `ESA_DOMAIN.md`

## Local development

```bash
cp .env.example .env.local       # then fill in 4 keys
npm install
npm run dev
```

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
```

## Deploy

Push to `main` → Vercel auto-deploys.

See `CLAUDE.md` for full project context.
