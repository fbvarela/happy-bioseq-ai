# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

BioSeq AI is a Next.js 15 (App Router) web app that lets researchers paste or upload a DNA/RNA/protein sequence and get AI-driven biological analysis: sequence type detection, GC content, ORF finding, motif detection, an AI-generated plain-English annotation (gene/protein family/function/disease associations), a follow-up chat interface grounded in the analysis, variant (wild-type vs mutant) impact comparison, and PubMed literature search ranked by semantic similarity. It is one of ~23 sibling apps in the "Happy Factory" suite living under `/Users/fernando/Documents/git-projects/ai/`.

Deterministic bioinformatics can run two ways: a Python FastAPI + Biopython microservice (`bio-service/`) when `BIO_SERVICE_URL` is set, or a pure-TypeScript fallback engine (`lib/bio.ts`) used automatically if the service is unset or unreachable. AI annotation/chat/variant-impact calls go through either Claude (Anthropic SDK, default) or Cohere, selectable per-request.

## Quick Start / Commands

```bash
npm run dev          # next dev — Next.js app on :3000
npm run build         # next build
npm run start          # next start (production)
npm run lint            # next lint
npm run db:generate     # drizzle-kit generate (see Gotchas — schema not actually wired up)
npm run db:migrate      # drizzle-kit migrate
npm run bio:dev         # cd bio-service && uvicorn main:app --reload --port 8001
```

There is no test script in `package.json` — no test runner is configured for this app.

To run the Python bio-service locally: `cd bio-service && pip install -r requirements.txt`, then `npm run bio:dev` (serves on `:8001`). If `BIO_SERVICE_URL` is unset, the app silently uses `lib/bio.ts` instead — the service is optional for local dev.

## Architecture

- **Framework:** Next.js 15 / React 19, App Router, TypeScript strict mode.
- **Routing:** `app/page.tsx` (upload/paste sequence), `app/analyze/[id]/page.tsx` (analysis + chat for a saved sequence), `app/history/page.tsx` (recent analyses).
- **API routes** (`app/api/*/route.ts`):
  - `POST /api/analyze` — runs bio analysis (bio-service or TS fallback) + AI annotation, persists via `saveAnalysis`.
  - `POST /api/chat` — streams a chat response (plain chunked text stream, not SSE) grounded in a saved analysis; persists messages.
  - `POST /api/variant` — wild-type vs mutant diff + AI impact prediction.
  - `POST /api/literature` — PubMed E-utilities search, ranked via Cohere embeddings (cosine similarity), cached into the `literature` table for future pgvector queries.
  - `POST /api/setup` — calls `initDb()` to create tables/extensions; idempotent, safe to re-run.
- **AI provider abstraction:** `lib/ai.ts` picks `claude` (default) or `cohere` per request/env (`AI_PROVIDER`); `lib/claude.ts` and `lib/cohere.ts` implement matching `annotateSequence`, `streamChat`, `analyzeVariant` functions. Client-side toggle lives in `components/ProviderContext.tsx` (`useProvider()`), UI in `ProviderToggle`.
- **Data layer:** `lib/db.ts` uses `@neondatabase/serverless` (raw tagged-SQL `neon()` client, not an ORM query builder) against Neon Postgres with the `pgvector` extension. Tables: `sequence_analyses`, `chat_messages`, `literature` (with an `ivfflat` cosine index).
- **Bio engine:** `lib/bio.ts` is a from-scratch TS reimplementation (sequence type detection, GC content, ORF finding, motif detection) mirroring `bio-service/analyzers/`. It exists specifically to remove the Python service as a hard dependency.
- **Env access:** `lib/env.ts` exports `getEnv(key)`, which reads `process.env` first, then falls back to Cloudflare Workers bindings via `getCloudflareContext()` (lazy `require` of `@opennextjs/cloudflare`, swallowed if not present). Always use `getEnv()` instead of `process.env` directly in server code that must work under Cloudflare Workers.
- **State/theming:** `context/ThemeContext.tsx` (light/dark/system, persisted to `localStorage`), `components/ProviderContext.tsx` (AI provider choice). Both are plain React Context, no external state library.
- **Styling:** Tailwind CSS v3 with `darkMode: 'class'`. Custom `bio` color scale and `JetBrains Mono` font family in `tailwind.config.ts`. `app/globals.css` is small (33 lines) — mostly `.app-nav` and body dark-mode overrides; components otherwise use Tailwind utility classes directly. There is no `.card-grid` utility class defined here (unlike some sibling apps) — check before assuming factory-wide CSS classes exist in this app.
- **Path alias:** `@/*` maps to repo root (`tsconfig.json`).

## Auth

This app has **no authentication** — no login, session, or test-login route exists under `app/api/`. All API routes are open. This deviates from the cross-app `POST /api/auth/test-login` standard used elsewhere in the Happy Factory suite; if adding auth here, follow that convention for consistency.

## Environment Variables

From `.env.example` / `.dev.vars.example`:

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | `"claude"` (default) or `"cohere"` — selects default AI backend |
| `ANTHROPIC_API_KEY` | Claude API key (`lib/claude.ts`) |
| `COHERE_API_KEY` | Cohere API key (`lib/cohere.ts`, embeddings + optional chat) |
| `DATABASE_URL` | Neon Postgres connection string (pgvector extension required) |
| `BIO_SERVICE_URL` | Python bio-service base URL, e.g. `http://localhost:8001`; unset = TS fallback engine used |
| `PUBMED_API_KEY` | Optional; raises PubMed E-utilities rate limits |

`.dev.vars.example` is for Cloudflare Workers local dev secrets (copy to `.dev.vars`, gitignored).

## Deployment

Despite a `.vercel/` directory present locally, this app deploys to **Cloudflare Workers** via OpenNext (`@opennextjs/cloudflare`, referenced in `lib/env.ts`) — see `.github/workflows/deploy-cloudflare.yml` and `deploy-cloudflare-dev.yml`. The Python bio-service deploys separately (see `bio-service/Dockerfile`, `Procfile`, `docs/specs/bio-service-deployment.md`) — it is an independent service, not bundled into the Workers deploy.

## Gotchas

- **Drizzle is a dead dependency.** `drizzle-orm` and `drizzle-kit` are in `package.json` with `db:generate`/`db:migrate` scripts, but there is no `drizzle.config.ts`, no schema file under a `db/` or `drizzle/` directory, and `lib/db.ts` uses raw `neon()` tagged SQL directly. Running `db:generate`/`db:migrate` will likely fail or no-op. Schema changes are currently made by hand-editing `lib/schema.sql` and `initDb()` in `lib/db.ts` together.
- **Vector dimension mismatch between `lib/schema.sql` and `lib/db.ts`.** `lib/schema.sql` declares `embedding vector(1536)` with a comment claiming OpenAI `text-embedding-3-small` dimensions, but `lib/db.ts`'s `initDb()` (the code path actually executed via `/api/setup`) declares `vector(1024)` — which matches the actual embedding model in use, Cohere `embed-english-v3.0` (see `app/api/literature/route.ts`). Treat `lib/db.ts` as the source of truth; `lib/schema.sql` is stale and should be corrected or removed if edited.
- **Bio-service is optional and silently falls back.** `/api/analyze` and `/api/variant` try `BIO_SERVICE_URL` first (30s / 15s timeout) and fall back to `lib/bio.ts` on any failure, including if the env var is simply unset. Don't assume the Python service is running in dev — verify which engine actually produced a given analysis if debugging discrepancies.
- **`getEnv()` vs `process.env`.** Most of the code uses `getEnv()` from `lib/env.ts`, but `app/api/analyze/route.ts`, `app/api/variant/route.ts`, and `lib/ai.ts` read `process.env` directly for `BIO_SERVICE_URL` / `AI_PROVIDER`. This works locally/on Vercel but will silently return `undefined` under actual Cloudflare Workers runtime for those two — worth aligning if Workers deploy breaks on those specific vars.
- **README.md is a stub** — just says `happy-dna-ai` (an old project name), not the current `bioseq-ai`. `docs/TECHNICAL-REFERENCE.md` and `docs/specs/*.md` (product-spec, implementation-plan, bio-service-deployment) are the more current/detailed docs.
