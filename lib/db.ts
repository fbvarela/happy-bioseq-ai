import { neon } from "@neondatabase/serverless";
import type { SequenceAnalysisResult, LiteratureResult } from "./types";
import { getEnv } from "@/lib/env";

function getDb() {
  const url = getEnv("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export async function initDb() {
  const sql = getDb();
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await sql`
    CREATE TABLE IF NOT EXISTS sequence_analyses (
      id           TEXT PRIMARY KEY,
      raw_sequence TEXT NOT NULL,
      bio_analysis JSONB NOT NULL,
      ai_annotation JSONB NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      analysis_id TEXT NOT NULL REFERENCES sequence_analyses(id) ON DELETE CASCADE,
      role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_analysis_id
      ON chat_messages(analysis_id, created_at)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS literature (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      pubmed_id  TEXT UNIQUE,
      title      TEXT NOT NULL,
      abstract   TEXT,
      embedding  vector(1024),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function saveAnalysis(result: SequenceAnalysisResult): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO sequence_analyses (id, raw_sequence, bio_analysis, ai_annotation, created_at)
    VALUES (
      ${result.id},
      ${result.rawSequence},
      ${JSON.stringify(result.bioAnalysis)},
      ${JSON.stringify(result.aiAnnotation)},
      ${result.createdAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      bio_analysis = EXCLUDED.bio_analysis,
      ai_annotation = EXCLUDED.ai_annotation
  `;
}

export async function getAnalysis(id: string): Promise<SequenceAnalysisResult | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, raw_sequence, bio_analysis, ai_annotation, created_at
    FROM sequence_analyses
    WHERE id = ${id}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as string,
    rawSequence: row.raw_sequence as string,
    bioAnalysis: row.bio_analysis as SequenceAnalysisResult["bioAnalysis"],
    aiAnnotation: row.ai_annotation as SequenceAnalysisResult["aiAnnotation"],
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function saveChatMessage(
  analysisId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO chat_messages (analysis_id, role, content)
    VALUES (${analysisId}, ${role}, ${content})
  `;
}

export async function getChatHistory(
  analysisId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const sql = getDb();
  const rows = await sql`
    SELECT role, content
    FROM chat_messages
    WHERE analysis_id = ${analysisId}
    ORDER BY created_at ASC
  `;
  return rows as Array<{ role: "user" | "assistant"; content: string }>;
}

export async function getRecentAnalyses(limit = 20): Promise<
  Array<{ id: string; sequenceType: string; length: number; summary: string; createdAt: string }>
> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, raw_sequence, bio_analysis, ai_annotation, created_at
    FROM sequence_analyses
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id as string,
    sequenceType: (r.bio_analysis as { sequenceType: string }).sequenceType,
    length: (r.bio_analysis as { length: number }).length,
    summary: (r.ai_annotation as { summary: string }).summary?.slice(0, 120) ?? "",
    createdAt: (r.created_at as Date).toISOString(),
  }));
}

export async function saveLiterature(
  papers: LiteratureResult[],
  embeddings: number[][]
): Promise<void> {
  const sql = getDb();
  for (let i = 0; i < papers.length; i++) {
    const p = papers[i];
    const emb = embeddings[i];
    await sql`
      INSERT INTO literature (pubmed_id, title, abstract, embedding)
      VALUES (${p.pubmedId}, ${p.title}, ${p.abstract}, ${JSON.stringify(emb)})
      ON CONFLICT (pubmed_id) DO UPDATE SET
        title    = EXCLUDED.title,
        abstract = EXCLUDED.abstract,
        embedding = EXCLUDED.embedding
    `;
  }
}

export async function findSimilarLiterature(
  queryEmbedding: number[],
  limit = 5
): Promise<LiteratureResult[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT pubmed_id, title, abstract,
           1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS relevance_score
    FROM literature
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    pubmedId: r.pubmed_id as string,
    title: r.title as string,
    abstract: r.abstract as string,
    relevanceScore: r.relevance_score as number,
    url: `https://pubmed.ncbi.nlm.nih.gov/${r.pubmed_id}/`,
  }));
}
