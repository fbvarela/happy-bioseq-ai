# BioSeq AI — Technical Reference

> Complete reference for tools, Python libraries, API endpoints, and AI prompts used in this project.

---

## Table of Contents

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Python Bio-Service — Libraries](#2-python-bio-service--libraries)
3. [Python Bio-Service — API Endpoints](#3-python-bio-service--api-endpoints)
4. [Next.js API Routes](#4-nextjs-api-routes)
5. [AI Prompts & System Messages](#5-ai-prompts--system-messages)
6. [External APIs](#6-external-apis)
7. [Database Schema](#7-database-schema)
8. [Environment Variables](#8-environment-variables)
9. [Data Flow](#9-data-flow)
10. [Key Files Reference](#10-key-files-reference)

---

## 1. Tech Stack Overview

### Frontend
| Tool | Version | Role |
|------|---------|------|
| Next.js | 15.1.0 | App framework (App Router, API Routes) |
| React | 19.0.0 | UI rendering |
| TypeScript | 5.7.3 | Type safety |
| Tailwind CSS | 3.4.17 | Styling (custom `bio-green` theme) |
| react-markdown | 10.1.0 | Renders AI chat responses |
| rehype-sanitize | 6.0.0 | Sanitises markdown HTML output |
| @anthropic-ai/sdk | 0.39.0 | Claude API client |
| cohere-ai | 8.0.0 | Cohere API client |
| @neondatabase/serverless | 0.10.0 | Neon Postgres HTTP driver |

### Python Bio-Service
| Tool | Version | Role |
|------|---------|------|
| FastAPI | 0.115.6 | REST API framework |
| Uvicorn | 0.32.1 | ASGI server |
| Biopython | 1.84 | Core bioinformatics engine |
| Pydantic | 2.10.3 | Request/response validation |
| python-multipart | 0.0.20 | Multipart form data support |

### Infrastructure
| Tool | Role |
|------|------|
| Neon Postgres + pgvector | Primary database + vector similarity search |
| PubMed API (NCBI eutils) | Scientific literature search |
| Vercel | Frontend (Next.js) deployment |
| Fly.io | Python bio-service deployment (Docker-based PaaS) |
| Docker | Bio-service containerisation (`bio-service/Dockerfile`) |

---

## 2. Python Bio-Service — Libraries

### `biopython` 1.84

The core bioinformatics engine. Used for:

| Biopython Module | What it does in BioSeq |
|-----------------|------------------------|
| `Bio.Seq.Seq` | Sequence object: transcription, translation, complement |
| `Bio.SeqUtils.gc_fraction` | Calculates GC content percentage |
| `Bio.SeqRecord.SeqRecord` | Sequence + metadata container |
| `Bio.SeqUtils.ProtParam.ProteinAnalysis` | Amino acid composition analysis |
| `Bio.Align.PairwiseAligner` | Global pairwise alignment for variant comparison (replaces deprecated `pairwise2` in ≥1.80) |

**ORF detection** is implemented manually using Biopython's `Seq.translate()` across all 6 reading frames (3 forward + 3 reverse complement). Only ORFs ≥ 100 nucleotides (~33 amino acids) are returned; results are sorted by length and capped at 10.

**Motif detection** uses Python `re` (regex) against a hardcoded motif database (see [Section 3](#3-python-bio-service--api-endpoints)).

### TypeScript Bio Engine — `lib/bio.ts`

A full TypeScript port of the bio-service analysis pipeline. Used when `BIO_SERVICE_URL` is not set, and as automatic fallback when the Python service is unreachable. Runs inside Vercel Functions — no separate service needed.

| Function | Equivalent Python |
|---|---|
| `detectSequenceType(seq)` | `analyzers/sequence.py:detect_sequence_type` |
| `gcContent(seq)` | `Bio.SeqUtils.gc_fraction` |
| `findORFs(seq, minLengthNt)` | `analyzers/sequence.py:find_orfs` |
| `findMotifs(seq, type)` | `analyzers/sequence.py:find_motifs` |
| `findRepeats(seq)` | `analyzers/sequence.py:find_repeats` |
| `aminoAcidComposition(seq)` | `Bio.SeqUtils.ProtParam.ProteinAnalysis` |
| `analyzeSequenceTS(seq)` | `analyzers/sequence.py:analyze_sequence` |
| `variantDiffTS(wt, mt)` | `analyzers/variant.py:align_and_diff` (same-length only) |

**Trade-off vs Biopython:** equal-length variant diff is identical; unequal-length variants use positional comparison instead of global alignment (no gap penalties). All other analysis results are equivalent.

---

### `fastapi` 0.115.6

Provides:
- Async request handling
- Automatic OpenAPI docs at `GET /docs`
- CORS middleware (allows `localhost:3000` and Vercel subdomains)

### `uvicorn` 0.32.1

ASGI server. Dev start command:
```bash
uvicorn main:app --reload --port 8001
```

### `pydantic` 2.10.3

All request bodies and responses are validated via Pydantic v2 models:
```python
class AnalyzeRequest(BaseModel):
    sequence: str   # min 10, max 100,000 characters

class VariantRequest(BaseModel):
    wild_type: str
    mutant: str
```

### `python-multipart` 0.0.20

Required by FastAPI to parse form data. Present for potential FASTA file upload support via the bio-service directly.

---

## 3. Python Bio-Service — API Endpoints

Base URL (local dev): `http://localhost:8001`

---

### `POST /analyze` — Full Sequence Analysis

Performs deterministic bioinformatics analysis on a DNA, RNA, or protein sequence.

**Request body:**
```json
{
  "sequence": "ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG"
}
```

**Response:**
```json
{
  "sequenceType": "DNA",
  "length": 42,
  "gcContent": 52.38,
  "orfs": [
    {
      "start": 0,
      "end": 42,
      "strand": "+",
      "length": 14,
      "translation": "MAIVMGR*KGARD"
    }
  ],
  "motifs": [
    {
      "name": "Kozak sequence",
      "pattern": "GCCACCATG",
      "positions": [1]
    }
  ],
  "repeatRegions": [
    {
      "sequence": "AT",
      "count": 5,
      "positions": [0]
    }
  ],
  "translation": "MAIVMGR*KGARD"
}
```

**Processing steps:**

1. **Validate** — rejects sequences outside 10–100,000 chars.
2. **Detect type** — classifies as `DNA`, `RNA`, `protein`, or `unknown` by character composition.
3. **GC content** — computed via `Bio.SeqUtils.gc_fraction` (DNA/RNA only).
4. **ORF search** — scans all 6 reading frames; returns top 10 by length (min 100 nt).
5. **Motif detection** — regex scan against hardcoded motif database:

| Motif name | Pattern | Applies to |
|------------|---------|-----------|
| TATA box | `TATAAA` | DNA |
| Kozak sequence | `GCCACCATG` | DNA |
| Poly-A signal | `AATAAA` | DNA |
| CpG dinucleotide | `CG` | DNA |
| BamHI restriction site | `GGATCC` | DNA |
| EcoRI restriction site | `GAATTC` | DNA |
| HindIII restriction site | `AAGCTT` | DNA |
| Shine-Dalgarno | `AGGAGG` | RNA |
| RGD motif | `RGD` | Protein |
| Nuclear localisation signal | `KKKRKV` | Protein |
| N-glycosylation site | `N[^P][ST]` | Protein |
| PKA phosphorylation site | `R[RK].[ST]` | Protein |
| CAAX prenylation box | `C[A-Z]{2}[AFIM]$` | Protein |

6. **Repeat detection** — finds simple sequence repeats (SSRs / microsatellites) of 2–4 nt appearing ≥ 3 times.
7. **Amino acid composition** — computed via `ProteinAnalysis` (protein sequences only).

---

### `POST /variant` — Pairwise Alignment & Diff

Compares a wild-type and mutant sequence to find positions of change.

**Request body:**
```json
{
  "wild_type": "ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG",
  "mutant":    "ATGGCCATTGTAATGGGCCGCTGAAGGGGTGCCCGATAG"
}
```

**Response:**
```json
{
  "diff_positions": [27, 30],
  "num_substitutions": 2,
  "num_insertions": 0,
  "num_deletions": 0,
  "alignment_score": 0.95
}
```

**Processing steps:**

- If sequences are the **same length**: simple positional comparison — no alignment needed.
- If sequences are **different lengths**: global pairwise alignment via `Bio.Align.PairwiseAligner`:
  - Match score: **+2**
  - Mismatch penalty: **−1**
  - Gap open penalty: **−5**
  - Gap extend penalty: **−0.5**
  - Aligned sequences reconstructed from `aln.aligned` coordinate blocks
- Returns at most 100 diff positions.
- `alignment_score` is normalised to 0.0–1.0.

---

### `GET /health` — Health Check

**Response:**
```json
{ "status": "ok" }
```

Used by the Next.js API routes to detect bio-service availability before calling it. If this fails, Next.js falls back to a built-in deterministic analyser.

---

## 4. Next.js API Routes

Base URL (local dev): `http://localhost:3000`

---

### `POST /api/analyze` — Orchestrated Sequence Analysis

Main entry point. Calls the bio-service, then the AI provider, then saves to DB.

**Request body:**
```json
{
  "sequence": "ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG",
  "provider": "claude"
}
```
`provider`: `"claude"` (default) | `"cohere"`

**Response:**
```json
{
  "id": "uuid-v4",
  "rawSequence": "ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG",
  "bioAnalysis": { /* bio-service response */ },
  "aiAnnotation": {
    "summary": "...",
    "potentialGene": "TP53",
    "proteinFamily": "p53 protein family",
    "biologicalFunction": "transcription regulation",
    "diseaseAssociations": ["cancer", "Li-Fraumeni syndrome"],
    "structuralFeatures": ["zinc finger domain", "DNA binding domain"]
  },
  "createdAt": "2026-04-04T12:00:00Z"
}
```

**Processing pipeline:**
1. Clean input: uppercase, strip whitespace.
2. Call `POST /analyze` on bio-service. On failure, use built-in fallback.
3. Call Claude or Cohere with sequence + bioinformatics results for annotation.
4. Generate a UUID for this analysis.
5. Save to `sequence_analyses` table asynchronously (non-blocking).
6. Return full result.

---

### `POST /api/chat` — Streaming Conversational AI

**Request body:**
```json
{
  "analysisId": "uuid-v4",
  "message": "What disease could a mutation at position 100 cause?",
  "provider": "claude"
}
```

**Response:** Server-Sent text stream (chunked transfer). Each chunk is a string fragment of the assistant's response.

**Processing steps:**
1. Fetch analysis from `sequence_analyses` by `analysisId`.
2. Fetch last 20 messages from `chat_messages` for that analysis.
3. Build system prompt with sequence context (see [Section 5](#5-ai-prompts--system-messages)).
4. Stream response from Claude or Cohere.
5. Save user message and complete assistant response to DB (non-blocking).

**Hardcoded suggested questions (shown in the UI):**
- "What disease could a mutation at position 100 cause?"
- "Are there known drugs targeting this protein family?"
- "Summarize what this gene does in plain English"
- "What species share similar sequences?"
- "Is this likely a coding or non-coding region?"
- "What would happen if this gene were knocked out?"
- "Are there known SNPs at any of the motif sites?"
- "Which transcription factors might regulate this gene?"
- "Is this sequence conserved across mammals?"
- "What experimental techniques would validate this annotation?"
- "Could this encode a transmembrane protein?"
- "What is the significance of the GC content level?"

---

### `POST /api/variant` — AI Variant Impact Prediction

**Request body:**
```json
{
  "wildType": "ATGGCCATTGTAATGGGCC...",
  "mutant":   "ATGGCCATTGTAATGGGCC...",
  "provider": "claude"
}
```

**Response:**
```json
{
  "wildType": "...",
  "mutant": "...",
  "diffPositions": [27, 30],
  "sequenceType": "nucleotide",
  "impact": "likely_deleterious",
  "score": 0.75,
  "explanation": "The substitution at position 27 affects a conserved region...",
  "conservedPositions": [25, 26, 27, 28, 30]
}
```

**`impact` values:** `benign` | `likely_benign` | `uncertain` | `likely_deleterious` | `deleterious`

**Processing steps:**
1. Detect sequence type (`nucleotide` or `protein`).
2. Optionally call bio-service `/variant` for alignment diff. Falls back gracefully if unavailable.
3. Call AI for impact prediction with extended thinking.
4. Return combined result.

---

### `POST /api/literature` — PubMed Search + Semantic Ranking

**Request body:**
```json
{
  "query": "optional override query",
  "annotation": {
    "summary": "...",
    "potentialGene": "TP53",
    "proteinFamily": "p53 family",
    "biologicalFunction": "transcription regulation"
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "pubmedId": "12345678",
      "title": "p53 mutational analysis in colorectal cancer",
      "abstract": "We investigated mutations in the TP53 gene...",
      "relevanceScore": 0.92,
      "url": "https://pubmed.ncbi.nlm.nih.gov/12345678/"
    }
  ]
}
```

**Processing steps:**
1. Build a search query from `annotation` fields if no explicit `query` is provided.
2. Call PubMed `esearch` API (max 8 results), then `esummary` to fetch titles and abstracts.
3. Embed query + all abstracts using **Cohere `embed-english-v3.0`** (1024-dim vectors).
4. Rank results by cosine similarity between query embedding and each abstract embedding.
5. Save results to `literature` table with embeddings (non-blocking, for future pgvector queries).
6. Return top 6 results.

---

### `POST /api/setup` — Database Initialisation

**Request body:** `{}`

**Response:** `{ "ok": true }`

Creates the `pgvector` extension and all three tables if they do not yet exist. Safe to call repeatedly (uses `CREATE TABLE IF NOT EXISTS`).

---

## 5. AI Prompts & System Messages

### System Prompt (shared by Claude and Cohere)

```
You are BioSeq AI, an expert bioinformatics assistant specializing in DNA, RNA,
and protein sequence analysis. You have deep knowledge of molecular biology,
genomics, proteomics, and structural biology.

When analyzing sequences:
- Be precise and scientifically accurate
- Use standard nomenclature (HGNC gene names, UniProt identifiers, etc.)
- Cite relevant biological context
- Explain findings in plain English while maintaining scientific rigor
- Flag uncertainties clearly

You assist wet-lab biologists who may not have computational expertise.
```

---

### Sequence Annotation Prompt

Sent to Claude with **extended thinking** (1,024-token budget) or to Cohere with JSON mode.

```
Analyze this {sequenceType} sequence and provide biological annotation.

Sequence ({length} bp/aa):
{sequence — first 2,000 characters}

Bioinformatics results:
- GC Content: {gcContent}%
- ORFs found: {orfCount}
- Motifs detected: {motifNames, comma-separated}
{optional: Translation preview if ORFs found}

Respond in JSON format:
{
  "summary": "2–3 sentence plain-English summary of what this sequence likely is",
  "potentialGene": "gene name if identifiable, otherwise null",
  "proteinFamily": "protein family name if identifiable, otherwise null",
  "biologicalFunction": "description of likely function, otherwise null",
  "diseaseAssociations": ["disease1", "disease2"] or [],
  "structuralFeatures": ["feature1", "feature2"] or []
}
```

---

### Chat Prompt — Sequence Context Block

Prepended to each chat message as the system context (replaces the plain system prompt for chat calls):

```
You are BioSeq AI, an expert bioinformatics assistant.

SEQUENCE CONTEXT:
Type: {sequenceType}
Length: {length} residues
GC Content: {gcContent}%
ORFs found: {orfCount}
Annotation summary: {annotation.summary}

Raw sequence (first 500 characters):
{rawSequence — first 500 chars}

Use this context to answer questions about this specific sequence.
Be scientifically accurate and flag uncertainties.
```

Chat history is capped at **20 messages** (10 turns) to stay within model context limits.

---

### Variant Analysis Prompt

Sent with **extended thinking** enabled (same 1,024-token budget):

```
Compare this {sequenceType} wild-type vs mutant sequence and predict functional impact.

Wild-type:
{wildType — first 500 characters}

Mutant:
{mutant — first 500 characters}

Identify the differences and assess the likely functional impact.
Respond in JSON format:
{
  "impact": "benign" | "likely_benign" | "uncertain" | "likely_deleterious" | "deleterious",
  "score": 0.0 to 1.0,
  "explanation": "detailed explanation of predicted impact on protein function",
  "conservedPositions": [list of integer position indices that appear highly conserved]
}
```

---

### Claude Configuration

| Parameter | Value |
|-----------|-------|
| Model | `claude-opus-4-6` |
| Extended thinking | Enabled for annotation and variant calls |
| Thinking budget | 1,024 tokens |
| Response format | JSON (parsed from text output) |
| Stream | Enabled for chat calls |

### Cohere Configuration

| Parameter | Value |
|-----------|-------|
| Chat model | `command-r-plus-08-2024` |
| Embed model | `embed-english-v3.0` |
| Embedding dimensions | 1,024 |
| Input type | `search_query` (query) / `search_document` (abstracts) |
| `preamble` | Same text as Claude's system prompt |
| `responseFormat` | `{ type: "json_object" }` for annotation/variant |
| Stream | Enabled for chat calls |

---

## 6. External APIs

### PubMed / NCBI E-utilities

| Endpoint | Purpose |
|----------|---------|
| `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` | Search PubMed by query string, returns PMIDs |
| `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi` | Fetch title + abstract for a list of PMIDs |

**Parameters used:**
- `db=pubmed`
- `retmax=8` (max results fetched from PubMed)
- `retmode=json`
- `api_key={PUBMED_API_KEY}` (optional — higher rate limit with a key)

---

## 7. Database Schema

### `sequence_analyses`

```sql
CREATE TABLE sequence_analyses (
  id            TEXT PRIMARY KEY,
  raw_sequence  TEXT NOT NULL,
  bio_analysis  JSONB NOT NULL,
  ai_annotation JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### `chat_messages`

```sql
CREATE TABLE chat_messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id TEXT NOT NULL REFERENCES sequence_analyses(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_analysis_id ON chat_messages (analysis_id, created_at);
```

### `literature`

```sql
CREATE TABLE literature (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  pubmed_id  TEXT UNIQUE,
  title      TEXT NOT NULL,
  abstract   TEXT,
  embedding  vector(1024),   -- Cohere embed-english-v3.0
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Requires the `pgvector` extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 8. Environment Variables

```bash
# AI Provider selection: "claude" | "cohere"
AI_PROVIDER=claude

# Anthropic — required for Claude provider
ANTHROPIC_API_KEY=sk-ant-...

# Cohere — required for embeddings (literature search) and Cohere provider
COHERE_API_KEY=...

# Neon Postgres with pgvector extension
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require

# Python bio-service URL
# local dev: http://localhost:8001
# production: https://your-bio-service.example.com
BIO_SERVICE_URL=http://localhost:8001

# Optional: PubMed API key (free access works without it, but rate-limited)
PUBMED_API_KEY=
```

---

## 9. Data Flow

```
User (browser)
    │
    │ paste sequence / FASTA upload
    ▼
Next.js Frontend  ──────────────────────────────────────────────────────────────┐
    │                                                                            │
    │ POST /api/analyze                                                          │
    ▼                                                                            │
Next.js API Route                                                                │
    │                                                                            │
    ├──► POST http://localhost:8001/analyze                                      │
    │         (Python bio-service: Biopython)                                    │
    │         ← bioAnalysis JSON                                                 │
    │                                                                            │
    ├──► Claude / Cohere API                                                     │
    │         (annotation prompt + extended thinking)                            │
    │         ← aiAnnotation JSON                                                │
    │                                                                            │
    └──► Neon Postgres (async, non-blocking)                                     │
              INSERT INTO sequence_analyses                                       │
                                                                                 │
    ◄────────────────────────────────────────────────────────────────────────────┘
    full result { id, bioAnalysis, aiAnnotation }
    │
    │ navigate to /analyze/{id}
    ▼
Analysis Detail Page
    │
    ├──► POST /api/chat       ──► Claude/Cohere (stream)  ──► chat_messages (async)
    │
    └──► POST /api/literature ──► PubMed API
                               ──► Cohere Embeddings (ranking)
                               ──► literature table (async)
```

---

## 10. Key Files Reference

```
happy-bioseq-ai/
│
├── .env.example                     # All required environment variables
├── package.json                     # NPM dependencies + scripts
│   └── scripts:
│       ├── dev          next dev
│       ├── build        next build
│       ├── bio:dev      uvicorn main:app --reload --port 8001
│       └── db:migrate   migration tooling
│
├── app/
│   ├── layout.tsx                   # Root layout, nav, ProviderToggle
│   ├── page.tsx                     # Home: Analyze / Variant tabs
│   ├── history/page.tsx             # Last 20 analyses from DB
│   ├── analyze/[id]/page.tsx        # Analysis detail (server component + Suspense)
│   └── api/
│       ├── analyze/route.ts         # POST — main analysis pipeline
│       ├── chat/route.ts            # POST — streaming chat
│       ├── variant/route.ts         # POST — variant impact
│       ├── literature/route.ts      # POST — PubMed + embeddings
│       └── setup/route.ts           # POST — DB init
│
├── lib/
│   ├── types.ts                     # BioAnalysis, AIAnnotation, ChatMessage types
│   ├── ai.ts                        # Provider resolver (Claude vs Cohere)
│   ├── claude.ts                    # Claude client, prompts, streaming
│   ├── cohere.ts                    # Cohere client, prompts, embeddings
│   ├── bio.ts                       # TypeScript bio engine (ORFs, motifs, GC, etc.)
│   └── db.ts                        # Neon client, all DB queries
│
├── components/
│   ├── SequenceInput.tsx            # Textarea + FASTA upload + examples
│   ├── VariantComparator.tsx        # Wild-type vs mutant side-by-side UI
│   ├── AnalysisPanel.tsx            # ORF map, motifs, AA chart, annotation
│   ├── ChatInterface.tsx            # Streaming chat, markdown, suggestions
│   ├── LiteraturePanel.tsx          # PubMed results, relevance scores
│   ├── ProviderContext.tsx          # React Context for Claude/Cohere toggle
│   ├── AnalyzePageClient.tsx        # Container for chat + literature panels
│   ├── AnalysisSkeleton.tsx         # Suspense loading state
│   ├── SetupButton.tsx              # Triggers /api/setup
│   └── CopyLinkButton.tsx           # Copies analysis URL to clipboard
│
└── bio-service/                     # Python FastAPI service
    ├── main.py                      # App entry point, CORS, routes
    ├── requirements.txt             # Python dependencies
    └── analyzers/
        ├── sequence.py              # Biopython: type detect, ORFs, motifs, GC
        └── variant.py               # Biopython: pairwise alignment, diff
```
