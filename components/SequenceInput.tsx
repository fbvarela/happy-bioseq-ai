"use client";

import { useState, useRef } from "react";

interface Props {
  onAnalyze: (sequence: string) => void;
  loading: boolean;
}

const EXAMPLE_SEQUENCES = {
  DNA: "ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG",
  RNA: "AUGGCCAUUGUAAUGGGCCGCUGAAAGGGUGCCCGAUAG",
  Protein: "MADVGLKKLVPETGDSVALSSILEKDYGEFKNSGDDISYRIDK",
};

export default function SequenceInput({ onAnalyze, loading }: Props) {
  const [sequence, setSequence] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target?.result as string;
      // Strip FASTA header if present
      if (text.startsWith(">")) {
        text = text.split("\n").slice(1).join("").replace(/\s/g, "");
      }
      setSequence(text.trim());
    };
    reader.readAsText(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = sequence.trim().replace(/\s+/g, "");
    if (clean.length < 10) {
      setError("Sequence must be at least 10 characters");
      return;
    }
    setError("");
    onAnalyze(clean);
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Paste your sequence
          </label>
          <textarea
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            placeholder="ATGGCCTTAGCAGTCGATCGTAGC... (DNA, RNA, or protein)"
            rows={8}
            className="w-full font-mono text-sm bg-gray-900 text-green-400 border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 placeholder-gray-600 resize-y"
          />
          <div className="absolute bottom-3 right-3 text-xs text-gray-500">
            {sequence.replace(/\s/g, "").length} chars
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="submit"
            disabled={loading || !sequence.trim()}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Analyzing..." : "Analyze Sequence"}
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 border border-gray-600 hover:border-gray-400 text-gray-300 text-sm rounded-lg transition-colors"
          >
            Upload FASTA
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".fasta,.fa,.txt,.seq"
            className="hidden"
            onChange={handleFileUpload}
          />

          <div className="flex gap-2 ml-auto">
            <span className="text-xs text-gray-500">Examples:</span>
            {Object.entries(EXAMPLE_SEQUENCES).map(([label, seq]) => (
              <button
                key={label}
                type="button"
                onClick={() => setSequence(seq)}
                className="text-xs text-green-500 hover:text-green-400 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
