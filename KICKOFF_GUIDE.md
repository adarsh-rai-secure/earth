# Kickoff Guide — AMA Earth Live Build Scaffold

## Before You Start (5 minutes, do manually)

### 1. Create the GitHub repo
```bash
mkdir ama-earth-build && cd ama-earth-build
git init
```

### 2. Create a Supabase project
- Go to https://supabase.com/dashboard
- New project → Name: `ama-earth-build` → Region: US East → Generate password → Create
- Once created, go to Settings → API:
  - Copy `Project URL`
  - Copy `anon public` key
  - Copy `service_role` key (under "service_role secret")

### 3. Set up the Supabase schema
- In Supabase dashboard → SQL Editor → New query → Paste and run:

```sql
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_url TEXT,
  raw_text TEXT,
  extracted_data JSONB,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'extracting', 'extracted', 'generating', 'complete', 'error')),
  report JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'review', 'complete')),
  report_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assessment_documents (
  assessment_id UUID REFERENCES assessments(id),
  document_id UUID REFERENCES documents(id),
  doc_type TEXT,
  PRIMARY KEY (assessment_id, document_id)
);

ALTER PUBLICATION supabase_realtime ADD TABLE documents;
ALTER PUBLICATION supabase_realtime ADD TABLE assessments;
```

- Then go to Storage → New bucket → Name: `uploads` → Public: OFF → Create

### 4. Create a GitHub repo on github.com
- New repo: `ama-earth-build` → Private → No README → Create
- Copy the remote URL

### 5. Get your OpenRouter API key ready
- Go to https://openrouter.ai/keys
- Copy your key (or create one)

### 6. Set up Vercel
- Go to https://vercel.com/new
- Import the GitHub repo once it's pushed
- Add environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
  - `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key
  - `OPENROUTER_API_KEY` = your OpenRouter API key

---

## The Scaffold Prompt — Paste This Into Claude Code

Once you're in the `ama-earth-build` directory with git initialized, open Claude Code (VS Code chat window) and paste this:

---

**PASTE START ↓**

Read CLAUDE.md in this directory for full project context. This is a scaffold for a live build interview. Build the following from scratch. Do everything in order. Commit after each major step.

**Step 1: Initialize the Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

Accept defaults. After it finishes:

```bash
npm install @supabase/supabase-js pdf-parse
npm install -D @types/pdf-parse
```

Commit: "init: next.js + tailwind + supabase + pdf-parse"

**Step 2: Set up environment variables**

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<I will fill this>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<I will fill this>
SUPABASE_SERVICE_ROLE_KEY=<I will fill this>
OPENROUTER_API_KEY=<I will fill this>
```

Create `.env.example` with the same keys but no values. Add `.env.local` to `.gitignore` if it's not already there.

**Step 3: Create the Supabase client**

Create `src/lib/supabase.ts`:
- Export a browser client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Export a server/admin client using `SUPABASE_SERVICE_ROLE_KEY` for server-side operations

**Step 4: Create the OpenRouter wrapper**

Create `src/lib/openrouter.ts`:
- Export an async function `generateCompletion(systemPrompt: string, userMessage: string, model?: string)` that:
  - Calls `https://openrouter.ai/api/v1/chat/completions`
  - Uses `OPENROUTER_API_KEY` from env
  - Defaults model to `anthropic/claude-sonnet-4-20250514`
  - Returns the text content from the response
  - Handles errors with meaningful messages

**Step 5: Create the PDF extraction utility**

Create `src/lib/extract.ts`:
- Export an async function `extractTextFromPDF(buffer: Buffer): Promise<string>` using pdf-parse
- Export an async function `extractTextFromURL(fileUrl: string): Promise<string>` that fetches a file URL and extracts text

**Step 6: Create API routes**

Create `src/app/api/upload/route.ts`:
- POST handler that accepts FormData with a file
- Uploads file to Supabase storage bucket `uploads`
- Creates a record in the `documents` table with filename, file_url, status='uploaded'
- Returns the document ID and file URL

Create `src/app/api/extract/route.ts`:
- POST handler that accepts `{ documentId: string }`
- Fetches the document record from Supabase
- Downloads the file from Supabase storage
- Extracts text using pdf-parse
- Updates the document record with raw_text, status='extracted'
- Returns the extracted text

Create `src/app/api/generate/route.ts`:
- POST handler that accepts `{ documentId: string, template?: string }`
- Fetches the document's raw_text from Supabase
- Sends it to OpenRouter with a system prompt that says: "You are an environmental assessment analyst. Analyze the following document text and generate a structured summary identifying: 1) Property history and uses, 2) Potential environmental concerns, 3) Regulatory database findings, 4) Recommended classifications (REC, HREC, CREC, or none). Format the output as JSON with keys: property_summary, environmental_concerns (array), regulatory_findings (array), classifications (array with type, description, rationale), and executive_summary."
- Stores the LLM response as JSON in the document's `report` column, sets status='complete'
- Returns the generated report

**Step 7: Build the UI**

The UI should be clean, minimal, professional. Dark navy/slate background (#0f172a), white text, green accent (#22c55e) for status indicators. Think environmental consulting software, not a toy.

Create `src/app/components/Navbar.tsx`:
- Logo text "Ama Earth" on the left (green accent color)
- Navigation links: Dashboard, Assessments
- Clean horizontal bar, fixed top

Create `src/app/components/FileUpload.tsx`:
- Drag-and-drop upload zone
- Accepts PDF files
- Shows upload progress
- On successful upload, calls `/api/upload`, then automatically triggers `/api/extract`
- Shows processing status (uploading → extracting → ready)

Create `src/app/components/ReportViewer.tsx`:
- Takes a report JSON object as prop
- Displays each section: Property Summary, Environmental Concerns, Regulatory Findings, Classifications, Executive Summary
- Each concern/finding is a card with border
- Clean typography, readable

Create `src/app/page.tsx`:
- Dashboard view showing: project count, recent documents, quick-start button
- Simple stats cards at the top

Create `src/app/assessments/page.tsx`:
- Full assessment flow: upload documents → view extraction → generate report → view report
- Pipeline status bar showing: Upload → Extract → Generate → Complete
- The FileUpload and ReportViewer components integrated here
- A "Generate Report" button that calls `/api/generate` and displays the result in ReportViewer

**Step 8: Wire everything together**

Make sure:
- File upload → storage → extraction → generation → display works end-to-end
- Loading states are visible (spinners, status text)
- Errors are caught and displayed (not silent failures)
- The assessment page has a clean, linear flow

**Step 9: Git + Deploy**

```bash
git add .
git commit -m "feat: full scaffold with upload, extraction, generation pipeline"
git remote add origin <GITHUB_REMOTE_URL>
git push -u origin main
```

Vercel will auto-deploy. Verify the live URL works.

**Step 10: Copy in the agent commands**

Create `.claude/commands/` directory and copy in:
- plan.md
- test.md
- review.md
- observe.md

These are in the project root already. Move them to `.claude/commands/`.

Commit: "chore: add claude code agent commands"

**PASTE END ↑**

---

## After the Scaffold Is Built (Checklist)

Run through this before the interview starts:

- [ ] `npm run dev` works locally, app loads at localhost:3000
- [ ] Upload a PDF → text extraction works → raw text appears in Supabase
- [ ] Generate report button → OpenRouter returns structured JSON → report displays
- [ ] `git push origin main` → Vercel deploys → live URL loads
- [ ] `.env.local` has all 4 env vars filled in
- [ ] Vercel dashboard has all 4 env vars set
- [ ] `.claude/commands/` has plan.md, test.md, review.md, observe.md
- [ ] CLAUDE.md is in the project root
- [ ] ESA_DOMAIN.md is in the project root
- [ ] Test with a real PDF (find any Phase I ESA PDF online, or use a generic PDF)

## How to Use the Agents During the Interview

### Opening Ritual (first 5 minutes of the interview)

1. Isiah gives you the roadmap item
2. You say: "Give me two minutes to scope this out"
3. Open a Claude Code chat, type `/plan`
4. The planning agent asks you questions. Answer them based on what Isiah described.
5. It writes PLAN.md. You scan it, confirm it makes sense.
6. You tell Isiah: "Here's my plan" and walk through it briefly (30 seconds)
7. Start building

### During the Build

**Main terminal:** Your primary Claude Code instance. This is where you build features, write code, iterate.

**Second terminal:** Run `/test` once. Let it run build checks and API tests in the background. Glance at it every 10-15 minutes. If it reports a red, fix it.

**Third terminal (optional):** `/observe` is your reference desk. When you need to know "where does X happen" or "what's the schema for Y," ask observe instead of digging through files. Faster.

### Mid-build Check-in

If Isiah checks in and asks what you're doing:
- Reference the plan: "I'm in Phase 2 of the plan, working on [specific task]"
- Show the deployed URL if you've pushed
- Never say "I'm stuck." Say "I'm working through [specific thing]"

### Final 5 Minutes

1. Run `/review` in a terminal. Quick quality check.
2. Push final code to main. Wait for Vercel deploy.
3. Open the live URL, do a quick demo walkthrough.
4. Show the plan vs. what you shipped: "Here's the plan I wrote at the start, here's what I delivered."

## If the Roadmap Item Is Something Unexpected

The scaffold handles document processing and report generation. If the task is something completely different (auth system, billing integration, API client library, data migration), the scaffold still helps because:

- The project is initialized with TypeScript, Tailwind, Supabase, API routes
- The deploy pipeline works (push → live in 90 seconds)
- The agent commands work for any feature, not just ESA-specific ones
- You have a working app to extend, not a blank repo

The worst case is you build a new feature from scratch inside a clean Next.js project with working infrastructure. That's still faster than starting from zero.
