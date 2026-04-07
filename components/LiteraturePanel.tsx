"use client";

import { useState } from "react";
import type { LiteratureResult, AIAnnotation } from "@/lib/types";

interface Props {
  analysisId: string;
  annotation: AIAnnotation;
}

export default function LiteraturePanel({ annotation }: Props) {
  const [results, setResults] = useState<LiteratureResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotation }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results ?? []);
      setFetched(true);
    } catch {
      setError("Could not fetch literature. Check PUBMED_API_KEY and COHERE_API_KEY.");
    } finally {
      setLoading(false);
    }
  }

  if (!fetched) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-300 font-medium">Related Literature</h2>
          <button
            onClick={search}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            {loading ? "Searching PubMed..." : "Search PubMed"}
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Find related papers based on AI annotation — gene, protein family, and function.
        </p>
        {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-gray-300 font-medium">Related Literature</h2>
        <button
          onClick={search}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {results.length === 0 ? (
        <p className="text-sm text-gray-500">No results found for this annotation.</p>
      ) : (
        <div className="space-y-3">
          {results.map((paper) => (
            <a
              key={paper.pubmedId}
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gray-900 border border-gray-700 hover:border-green-700 rounded-lg p-3 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-gray-200 group-hover:text-white leading-snug line-clamp-2">
                  {paper.title}
                </p>
                <span className="shrink-0 text-xs text-gray-500 font-mono mt-0.5">
                  {(paper.relevanceScore * 100).toFixed(0)}%
                </span>
              </div>
              {paper.abstract && (
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{paper.abstract}</p>
              )}
              <p className="mt-1.5 text-xs text-green-600">PMID {paper.pubmedId} →</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
