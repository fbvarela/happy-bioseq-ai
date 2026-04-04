# BioSeq AI — Product Specification

**Version:** 0.1
**Status:** Draft
**Last updated:** 2026-04-04

---

## 1. Overview

BioSeq AI is a web application that lets researchers paste or upload biological sequences (DNA, RNA, protein) and receive instant AI-driven analysis without requiring command-line tools or bioinformatics expertise.

### 1.1 Problem

Wet-lab biologists generate sequences daily (PCR products, cloning results, sequencing reads) but lack computational skills to analyze them. Existing tools (BLAST, ExPASy, Benchling) require domain expertise, have no conversational interface, and cannot explain their outputs in plain English.

### 1.2 Target Users

- **Primary:** Wet-lab biologists with minimal computational background
- **Secondary:** Graduate students and postdocs who want faster preliminary analysis
- **Out of scope:** Bioinformaticians running large-scale pipelines (they have their own tooling)

### 1.3 Success Metrics

- User can go from pasting a sequence to understanding its function in < 60 seconds
- Chat answers are scientifically accurate and cite specific positions/features
- Variant impact predictions match ClinVar classifications for known variants ≥ 70% of the time

---

## 2. Features

### 2.1 Sequence Analysis Pipeline (Core)

**Input:**
- Paste raw sequence into a textarea
- Upload a `.fasta`, `.fa`, or `.txt` file
- FASTA headers are stripped automatically
- Whitespace and line breaks are normalized

**Auto-detection:**
- Sequence type is inferred from character composition: DNA (`ATGCN`), RNA (`AUGCN`), protein (IUPAC amino acids)
- Ambiguous sequences default to DNA; sequences containing `U` are classified as RNA
- Type can be overridden manually

**Deterministic analysis (via Python bio-service):**
- GC content (DNA/RNA)
- Open Reading Frames: all 6 reading frames, minimum length configurable (default 100 nt), top 10 by length returned
- Translation of the longest ORF
- Motif detection: TATA box, Kozak, restriction sites, N-glycosylation sites, PKA phosphorylation, RGD motif, etc.
- Simple sequence repeats / microsatellites (di- to hexa-nucleotide units)
- Amino acid composition (protein sequences)

**AI annotation (via Claude API):**
- Plain-English summary (2–3 sentences)
- Potential gene name (HGNC symbol)
- Protein family / domain
- Likely biological function
- Disease associations (list)
- Notable structural features

**Graceful degradation:** If the Python bio-service is unreachable, the API route falls back to basic character-level analysis. AI annotation still runs.

---

### 2.2 AI Annotation Chat

After analysis, users can converse with Claude about the sequence.

**Chat context includes:**
- Raw sequence (first 500 characters)
- All bioinformatics results (GC%, ORFs, motifs)
- AI annotation summary
- Full conversation history (current session)

**Example questions the chat handles:**
- "What disease could a mutation at position 142 cause?"
- "Are there known drugs targeting this protein family?"
- "Summarize what this gene does in plain English"
- "What species share similar sequences?"
- "Is this likely a coding or non-coding region?"

**Chat behavior:**
- Responses stream token-by-token (no loading wait)
- Conversation history persists in Postgres per analysis session
- Suggested starter questions shown when chat is empty
- System prompt enforces scientific accuracy and HGNC/UniProt nomenclature

---

### 2.3 Variant Impact Predictor

Separate tab for comparing wild-type vs. mutant sequences.

**Input:** Two textareas side-by-side (wild-type and mutant)

**Analysis:**
- Pairwise sequence alignment (global, Biopython)
- Differing positions highlighted in both sequences
- Count of substitutions, insertions, deletions

**AI prediction:**
- Impact classification: `benign` / `likely_benign` / `uncertain` / `likely_deleterious` / `deleterious`
- Confidence score (0–1)
- Plain-English explanation of predicted mechanism
- Identified conserved positions

**Display:**
- Color-coded impact badge with severity bar
- Highlighted diff view (mismatched characters highlighted in red)
- Score bar proportional to pathogenicity confidence

---

### 2.4 Literature Bridge (Planned — v0.2)

Links sequence findings to relevant PubMed abstracts via semantic search.

**Pipeline:**
1. Extract gene name and protein family from AI annotation
2. Embed query using OpenAI `text-embedding-3-small`
3. Search `literature` table using pgvector cosine similarity
4. Summarize top 5 matching abstracts via Claude

**Display:** Collapsible panel below the analysis, showing paper cards with title, relevance score, and a one-sentence AI summary.

---

## 3. Constraints & Non-Requirements

| Constraint | Detail |
|---|---|
| Max sequence length | 100,000 characters (enforced in bio-service) |
| Min sequence length | 10 characters |
| Authentication | None in v0.1 — all analyses are public by ID |
| Rate limiting | Enforced by Vercel Edge Config (planned) |
| Offline support | Not required |
| Mobile | Responsive layout required, but mobile is secondary |
| Multi-language | English only |
| Batch processing | Not in v0.1 |
| BLAST integration | Not in v0.1 — AI annotation substitutes for homology search |

---

## 4. Data Model

### `sequence_analyses`
| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | UUID generated server-side |
| `raw_sequence` | `TEXT` | Cleaned, uppercase |
| `bio_analysis` | `JSONB` | Output of Python bio-service |
| `ai_annotation` | `JSONB` | Output of Claude annotation |
| `created_at` | `TIMESTAMPTZ` | |

### `chat_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | UUID auto-generated |
| `analysis_id` | `TEXT FK` | References `sequence_analyses` |
| `role` | `TEXT` | `user` or `assistant` |
| `content` | `TEXT` | |
| `created_at` | `TIMESTAMPTZ` | |

### `literature` (v0.2)
| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `pubmed_id` | `TEXT UNIQUE` | |
| `title` | `TEXT` | |
| `abstract` | `TEXT` | |
| `embedding` | `vector(1536)` | pgvector, cosine index |
| `created_at` | `TIMESTAMPTZ` | |

---

## 5. API Contracts

### `POST /api/analyze`
**Request:** `{ sequence: string }`
**Response:** `SequenceAnalysisResult` (id, rawSequence, bioAnalysis, aiAnnotation, createdAt)
**Errors:** 400 (too short), 500 (analysis failed)

### `POST /api/chat`
**Request:** `{ analysisId: string, message: string }`
**Response:** `text/plain` stream (SSE-style chunked transfer)
**Errors:** 400 (missing fields), 404 (analysis not found), 500

### `POST /api/variant`
**Request:** `{ wildType: string, mutant: string }`
**Response:** `{ wildType, mutant, diffPositions, sequenceType, impact, score, explanation }`
**Errors:** 400, 500

### Bio-service `POST /analyze`
**Request:** `{ sequence: string }`
**Response:** `BioAnalysis` JSON

### Bio-service `POST /variant`
**Request:** `{ wild_type: string, mutant: string }`
**Response:** `{ diff_positions, num_substitutions, num_insertions, num_deletions, alignment_score }`

---

## 6. UX Flows

### Primary flow: Sequence Analysis
```
Home page
  → Paste sequence in textarea (or upload FASTA)
  → Click "Analyze Sequence"
  → Loading state (spinner)
  → Redirect to /analyze/[id]
  → Left column: Analysis panel (AI annotation + bioinformatics stats)
  → Right column: Chat interface (suggested questions)
  → User types a question → streaming response
```

### Variant flow
```
Home page → "Variant Comparator" tab
  → Paste wild-type in left textarea
  → Paste mutant in right textarea
  → Click "Compare Sequences"
  → Impact badge + score bar appears
  → Diff view shows mismatched positions highlighted
```

---

## 7. Error States

| Scenario | Handling |
|---|---|
| Bio-service unreachable | Fallback to character-level analysis; no error shown to user |
| DB unreachable | Analysis result returned from memory; save silently fails; no error shown |
| Claude API error | 500 returned with "Analysis failed" message |
| Sequence too short | Inline validation error before API call |
| Analysis ID not found | Next.js `notFound()` → 404 page |
| Chat stream interrupted | "Sorry, an error occurred. Please try again." in the chat bubble |
