import { NextRequest, NextResponse } from "next/server";
import { getCohere } from "@/lib/cohere";
import { saveLiterature, findSimilarLiterature } from "@/lib/db";
import type { LiteratureResult } from "@/lib/types";

import { getEnv } from "@/lib/env";

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PUBMED_KEY = getEnv("PUBMED_API_KEY") ? `&api_key=${getEnv("PUBMED_API_KEY")}` : "";

async function searchPubMed(query: string, maxResults = 8): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  const res = await fetch(
    `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encoded}&retmax=${maxResults}&retmode=json${PUBMED_KEY}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.esearchresult?.idlist ?? [];
}

async function fetchPubMedSummaries(ids: string[]): Promise<LiteratureResult[]> {
  if (ids.length === 0) return [];
  const res = await fetch(
    `${PUBMED_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json${PUBMED_KEY}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const results: LiteratureResult[] = [];

  for (const id of ids) {
    const doc = data.result?.[id];
    if (!doc) continue;
    results.push({
      pubmedId: id,
      title: doc.title ?? "Untitled",
      abstract: doc.source ?? "",
      relevanceScore: 0,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    });
  }
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const { query, annotation } = await req.json();

    if (!query && !annotation) {
      return NextResponse.json({ error: "query or annotation required" }, { status: 400 });
    }

    // Build PubMed search query from annotation fields
    const searchTerms: string[] = [];
    if (annotation?.potentialGene) searchTerms.push(annotation.potentialGene);
    if (annotation?.proteinFamily) searchTerms.push(annotation.proteinFamily);
    if (annotation?.biologicalFunction) searchTerms.push(annotation.biologicalFunction.split(" ").slice(0, 4).join(" "));
    if (query) searchTerms.push(query);

    const searchQuery = searchTerms.join(" AND ");

    // Fetch papers from PubMed
    const ids = await searchPubMed(searchQuery);
    if (ids.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const papers = await fetchPubMedSummaries(ids);
    if (papers.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Embed query + abstracts with Cohere for semantic ranking
    const queryText = annotation?.summary ?? query;
    const texts = [queryText, ...papers.map((p) => `${p.title}. ${p.abstract}`)];

    try {
      const embedRes = await getCohere().embed({
        model: "embed-english-v3.0",
        texts,
        inputType: "search_query",
        embeddingTypes: ["float"],
      });

      const rawEmb = embedRes.embeddings;
      const floatEmbeddings = rawEmb && !Array.isArray(rawEmb) ? rawEmb.float : undefined;
      if (floatEmbeddings && floatEmbeddings.length === texts.length) {
        const queryEmb = floatEmbeddings[0];
        const paperEmbs = floatEmbeddings.slice(1);

        // Score by cosine similarity
        for (let i = 0; i < papers.length; i++) {
          papers[i].relevanceScore = cosineSimilarity(queryEmb, paperEmbs[i]);
        }
        papers.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Persist to DB for future pgvector queries (non-blocking)
        saveLiterature(papers, paperEmbs).catch(console.error);
      }
    } catch {
      // Embedding failed — return unranked results
    }

    return NextResponse.json({ results: papers.slice(0, 6) });
  } catch (err) {
    console.error("Literature search error:", err);
    return NextResponse.json({ error: "Literature search failed" }, { status: 500 });
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}
