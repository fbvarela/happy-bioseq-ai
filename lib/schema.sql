-- BioSeq AI — Neon Postgres Schema
-- Run once: psql $DATABASE_URL -f lib/schema.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS sequence_analyses (
  id           TEXT PRIMARY KEY,
  raw_sequence TEXT NOT NULL,
  bio_analysis JSONB NOT NULL,
  ai_annotation JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  analysis_id  TEXT NOT NULL REFERENCES sequence_analyses(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_analysis_id
  ON chat_messages(analysis_id, created_at);

-- Literature table for pgvector semantic search
CREATE TABLE IF NOT EXISTS literature (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pubmed_id  TEXT UNIQUE,
  title      TEXT NOT NULL,
  abstract   TEXT,
  embedding  vector(1536),   -- OpenAI text-embedding-3-small dimensions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_literature_embedding
  ON literature USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
