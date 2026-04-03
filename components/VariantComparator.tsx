"use client";

import { useState } from "react";

interface VariantResult {
  wildType: string;
  mutant: string;
  diffPositions: number[];
  sequenceType: string;
  impact: string;
  score: number;
  explanation: string;
}

const IMPACT_CONFIG: Record<string, { label: string; color: string; bar: string }> = {
  benign: { label: "Benign", color: "text-green-400", bar: "bg-green-500" },
  likely_benign: { label: "Likely Benign", color: "text-green-300", bar: "bg-green-400" },
  uncertain: { label: "Uncertain", color: "text-yellow-400", bar: "bg-yellow-500" },
  likely_deleterious: { label: "Likely Deleterious", color: "text-orange-400", bar: "bg-orange-500" },
  deleterious: { label: "Deleterious", color: "text-red-400", bar: "bg-red-500" },
};

function SequenceViewer({ sequence, diffPositions, label }: { sequence: string; diffPositions: number[]; label: string }) {
  const diffSet = new Set(diffPositions);
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="font-mono text-xs bg-gray-900 border border-gray-700 rounded-lg p-3 break-all leading-relaxed">
        {sequence.split("").map((char, i) => (
          <span
            key={i}
            className={diffSet.has(i) ? "bg-red-900 text-red-300 rounded" : "text-green-300"}
          >
            {char}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function VariantComparator() {
  const [wildType, setWildType] = useState("");
  const [mutant, setMutant] = useState("");
  const [result, setResult] = useState<VariantResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!wildType.trim() || !mutant.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wildType, mutant }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Analysis failed");
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const impactConf = result ? (IMPACT_CONFIG[result.impact] ?? IMPACT_CONFIG.uncertain) : null;

  return (
    <div className="space-y-6">
      <form onSubmit={handleAnalyze} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Wild-type sequence</label>
            <textarea
              value={wildType}
              onChange={(e) => setWildType(e.target.value)}
              placeholder="ATGGCCATTGTAATG..."
              rows={5}
              className="w-full font-mono text-xs bg-gray-900 text-green-400 border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-green-500 placeholder-gray-600 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Mutant sequence</label>
            <textarea
              value={mutant}
              onChange={(e) => setMutant(e.target.value)}
              placeholder="ATGGCCATTGTAATG..."
              rows={5}
              className="w-full font-mono text-xs bg-gray-900 text-red-400 border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-red-500 placeholder-gray-600 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !wildType.trim() || !mutant.trim()}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? "Analyzing variants..." : "Compare Sequences"}
        </button>
      </form>

      {result && impactConf && (
        <div className="space-y-4">
          {/* Impact Score */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-200 font-medium">Variant Impact Prediction</h3>
              <span className={`font-semibold text-lg ${impactConf.color}`}>
                {impactConf.label}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full ${impactConf.bar} transition-all`}
                style={{ width: `${result.score * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{result.explanation}</p>
            <p className="text-xs text-gray-500 mt-2">
              Score: {(result.score * 100).toFixed(0)}% pathogenicity confidence
            </p>
          </div>

          {/* Sequence Diff */}
          {result.diffPositions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-gray-300 font-medium text-sm">
                Differences at {result.diffPositions.length} position{result.diffPositions.length !== 1 ? "s" : ""}
                {result.diffPositions.length <= 10 && `: ${result.diffPositions.map((p) => p + 1).join(", ")}`}
              </h3>
              <SequenceViewer
                sequence={result.wildType.slice(0, 300)}
                diffPositions={result.diffPositions.filter((p) => p < 300)}
                label="Wild-type"
              />
              <SequenceViewer
                sequence={result.mutant.slice(0, 300)}
                diffPositions={result.diffPositions.filter((p) => p < 300)}
                label="Mutant"
              />
              {result.wildType.length > 300 && (
                <p className="text-xs text-gray-500">Showing first 300 characters</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
