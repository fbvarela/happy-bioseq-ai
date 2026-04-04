# BioSeq AI — Implementation Plan

**Version:** 0.1
**Status:** Draft
**Last updated:** 2026-04-04

This document tracks what needs to be built, in what order, and what the acceptance criteria are for each piece. The scaffold has already been created — this plan focuses on making each component production-ready.

---

## Phase 0 — Local Development Setup (prerequisite)

Everything else depends on this working end-to-end locally.

### 0.1 Environment
- [ ] Copy `.env.example` → `.env.local`
- [ ] Add `ANTHROPIC_API_KEY`
- [ ] Provision a Neon Postgres database, add `DATABASE_URL`
- [ ] Set `BIO_SERVICE_URL=http://localhost:8001`

### 0.2 Database
- [ ] Run `psql $DATABASE_URL -f lib/schema.sql` to create tables and pgvector extension
- [ ] Verify the `vector` extension is available on the Neon project (requires Neon pgvector add-on)

### 0.3 Python bio-service
- [ ] Create a virtual environment: `python -m venv .venv && source .venv/bin/activate`
- [ ] Install deps: `pip install -r bio-service/requirements.txt`
- [ ] Start: `uvicorn main:app --reload --port 8001` from inside `bio-service/`
- [ ] Verify: `curl http://localhost:8001/health` returns `{"status":"ok"}`

### 0.4 Next.js
- [ ] `npm install`
- [ ] `npm run dev` — app loads at `localhost:3000`

**Acceptance:** Paste the example DNA sequence, click Analyze, get redirected to `/analyze/[id]` with a populated result.

---

## Phase 1 — Core Analysis Pipeline (critical path)

### 1.1 Fix `lib/db.ts` — lazy initialization

**Problem:** `initDb()` (which runs `CREATE TABLE`) is defined but never called. The tables must exist before any route uses the DB.

**Options (pick one):**
- **A. Migration script** (recommended): Run `schema.sql` once manually or via CI. Remove `initDb()` from `db.ts` — it's not needed at runtime if migrations are pre-run.
- **B. Auto-init on first request**: Call `initDb()` in a Next.js `instrumentation.ts` file (runs once on server start). Risk: cold start latency.

**Decision needed:** Choose option A (schema.sql already exists) and remove `initDb()` from `db.ts`.

### 1.2 Fix `app/api/analyze/route.ts` — error surface

**Current issues:**
- The `fetch` to bio-service uses `AbortSignal.timeout(30_000)` which is not supported in all Node runtimes. Replace with a manual `AbortController` + `setTimeout`.
- The fallback `BioAnalysis` object is missing `orfs: []` and `motifs: []` — downstream code may crash iterating undefined arrays. Add explicit empty arrays.
- `saveAnalysis` fires and forgets — add a structured log on failure (not just `console.error`).

### 1.3 Fix `lib/claude.ts` — JSON parsing robustness

**Current issue:** `annotateSequence` extracts JSON with a regex. Claude sometimes wraps JSON in a markdown code block (`` ```json ... ``` ``). The regex `\{[\s\S]*\}` will miss this.

**Fix:** Strip markdown fences before parsing:
```ts
const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
const jsonMatch = stripped.match(/\{[\s\S]*\}/);
```

### 1.4 Bio-service — ORF finder edge cases

**Current issues in `analyzers/sequence.py`:**
- `find_orfs` mutates `in_orf = False` without appending the last ORF if the sequence ends without a stop codon. Add a flush after the loop.
- The reverse complement ORF position calculation is incorrect for negative strand — `nt_start` / `nt_end` calculation needs review.
- `ProteinAnalysis` from Biopython raises `ValueError` for sequences containing `*` (stop codons) even after filtering — wrap in try/except per amino acid call.

### 1.5 End-to-end smoke test

Manual test sequence: `ATGAAAGCAATTTTCGTACTGAAAGGTTTTGTT` (short DNA with ATG start)
- Should detect as DNA
- GC content ~38%
- At least one ORF found
- AI annotation returns valid JSON with a summary

---

## Phase 2 — Analysis Results Page

### 2.1 `app/analyze/[id]/page.tsx` — loading state

**Current issue:** The page is a Server Component that fetches from DB synchronously. If the DB is slow, users see a blank page. Wrap in `Suspense` with a skeleton:

```tsx
// page.tsx → wrap content in Suspense
<Suspense fallback={<AnalysisSkeleton />}>
  <AnalysisContent id={id} />
</Suspense>
```

Create an `AnalysisSkeleton` component that mirrors the layout with gray pulse placeholders.

### 2.2 `components/AnalysisPanel.tsx` — sequence type badge colors

Add distinct color coding per type:
- DNA: green (`text-green-400`)
- RNA: blue (`text-blue-400`)
- protein: purple (`text-purple-400`)
- unknown: gray (`text-gray-400`)

### 2.3 `components/AnalysisPanel.tsx` — ORF visualization

Instead of a flat list, render a linear map: a horizontal bar representing the full sequence length with colored boxes for each ORF position. This is a core bioinformatics UX pattern.

**Implementation:** Pure CSS/SVG, no external library needed.
- Container = full sequence length (mapped to 100% width)
- Each ORF = `position: absolute; left: X%; width: Y%; height: 16px`
- Color by strand: green (+), orange (-)
- Hover tooltip showing start, end, length, translation preview

### 2.4 Share link

The analysis URL (`/analyze/[id]`) is already shareable by design. Add a "Copy link" button next to the analysis ID in the header.

---

## Phase 3 — Chat Interface

### 3.1 `app/api/chat/route.ts` — context window management

**Current issue:** `getChatHistory` fetches all messages — a long conversation will overflow Claude's context window.

**Fix:** Limit history to the last 20 messages (10 turns):
```ts
const history = (await getChatHistory(analysisId)).slice(-20);
```

Add a note in the UI ("Showing last 10 turns of conversation") when truncation occurs.

### 3.2 `components/ChatInterface.tsx` — markdown rendering

Claude's responses often include markdown (bullet points, bold text, code spans). Currently displayed as raw text.

**Fix:** Add `react-markdown` (lightweight, no heavy dependencies):
```bash
npm install react-markdown
```
Wrap assistant message content in `<ReactMarkdown>` with Tailwind prose classes.

**Caveat:** Sanitize output — use `rehype-sanitize` to prevent XSS from any hypothetical injection in chat content.

### 3.3 `components/ChatInterface.tsx` — empty state

When `messages.length === 0`, show suggested questions. This is already implemented. Additional improvement: randomize the 4 questions from a larger pool of 12 so repeat visitors see variety.

### 3.4 Chat message persistence timing

**Current issue:** The assistant message is saved to DB via `saveChatMessage` only after the stream completes. If the user closes the tab mid-stream, the message is lost.

**Acceptable for v0.1.** Note as known limitation. Fix in v0.2 by streaming into a buffer and saving with `upsert` on a stable message ID.

---

## Phase 4 — Variant Comparator

### 4.1 `bio-service/analyzers/variant.py` — Biopython deprecation

`Bio.pairwise2` is deprecated in Biopython ≥ 1.80. Replace with `Bio.Align.PairwiseAligner`:

```python
from Bio.Align import PairwiseAligner

aligner = PairwiseAligner()
aligner.mode = "global"
aligner.match_score = 2
aligner.mismatch_score = -1
aligner.open_gap_score = -5
aligner.extend_gap_score = -0.5

alignments = aligner.align(wt, mt)
aln = next(iter(alignments))
```

### 4.2 `components/VariantComparator.tsx` — large sequence handling

**Current issue:** The component renders the entire sequence character-by-character with `map()`. For sequences > 1,000 characters this will be slow.

**Fix:** Virtual rendering — only render visible characters using a window. Alternatively, cap the rendered region at the first/last 200 characters around diff positions, with a "Show full sequence" toggle.

### 4.3 Variant result caching

Variant analyses are not persisted. For v0.1 this is acceptable (stateless). If the same WT+mutant pair is submitted twice, the AI runs again.

**Future:** Add a `variant_analyses` table keyed on `sha256(wt + mutant)`.

---

## Phase 5 — Deployment (Vercel)

### 5.1 Environment variables on Vercel

Add to Vercel project settings (or use `vercel env add`):
- `ANTHROPIC_API_KEY`
- `DATABASE_URL`
- `BIO_SERVICE_URL` (URL of the deployed bio-service)

### 5.2 Python bio-service deployment

The bio-service is a separate FastAPI process — it cannot run inside Vercel Serverless Functions.

**Options:**
- **A. Railway** (recommended for simplicity): Push `bio-service/` as a separate Railway service. Free tier supports it. Set `BIO_SERVICE_URL` to the Railway URL.
- **B. Fly.io**: Similar to Railway, good free tier, Docker-based.
- **C. Docker on any VPS**: If cost is a concern.
- **D. Eliminate the bio-service** (simplest): Port the Python logic to TypeScript using pure regex + character analysis. Loses Biopython's alignment quality but removes the dependency.

**For initial deployment, recommend option D** (TypeScript-only) to ship faster, then add the Python service for higher-quality ORF finding.

### 5.3 Next.js build checklist

- [ ] All environment variables referenced in server code exist in `.env.local` / Vercel
- [ ] `next build` completes without errors
- [ ] No `"use client"` components import `fs`, `path`, or other Node-only modules
- [ ] Dynamic routes (`/analyze/[id]`) use `generateStaticParams` or are explicitly dynamic

### 5.4 `next.config.ts` — remove empty experimental block

The `serverComponentsExternalPackages` key is empty and triggers a warning in Next.js 15. Remove it or add `@neondatabase/serverless` if needed.

---

## Phase 6 — Literature Bridge (v0.2)

Not blocking v0.1 launch. Design notes for future implementation:

### 6.1 Data ingestion

Build a one-time script (`scripts/ingest-literature.ts`) that:
1. Accepts a list of gene names or PubMed search terms
2. Fetches abstracts from the NCBI E-utilities API (free, no auth for low volume)
3. Embeds each abstract using OpenAI `text-embedding-3-small` (1536 dimensions, $0.02/1M tokens)
4. Upserts into the `literature` table

### 6.2 Search API

New endpoint `POST /api/literature`:
- Input: `{ query: string }` (gene name + protein family from AI annotation)
- Embed the query
- Run: `SELECT ... ORDER BY embedding <=> $1::vector LIMIT 5`
- Return top 5 results with similarity score

### 6.3 UI integration

Add a "Related Literature" accordion below the analysis panel. Each paper card shows:
- Title (linked to PubMed)
- One-sentence AI summary
- Relevance score badge

---

## Open Questions

| # | Question | Owner | Priority |
|---|---|---|---|
| 1 | Should analysis results expire? If yes, after how long? | Product | Low |
| 2 | Do we need auth in v0.1 or is public-by-ID sufficient? | Product | Medium |
| 3 | What's the deployment target for the Python bio-service — Railway, Fly, or inline TypeScript? | Engineering | High |
| 4 | Should the chat use prompt caching for the sequence context block? (Cost optimization) | Engineering | Low |
| 5 | Should we add a loading skeleton on `/analyze/[id]` while DB fetches? | Design | Medium |

---

## Known Limitations (v0.1)

- No authentication — anyone with an analysis ID can view it
- Chat history is capped at 20 messages to prevent context overflow
- Variant analysis is not persisted — reruns cost API tokens
- Bio-service ORF finder is basic — no reading frame probability weighting
- Literature search not implemented
- No rate limiting (Vercel free tier limits apply)
- AI variant impact scores are Claude's inference, not a validated clinical model
