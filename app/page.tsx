"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SequenceInput from "@/components/SequenceInput";
import VariantComparator from "@/components/VariantComparator";

type Tab = "analyze" | "variant";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const tab: Tab = searchParams.get("tab") === "variant" ? "variant" : "analyze";

  async function handleAnalyze(sequence: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Analysis failed");
      }

      const result = await res.json();
      router.push(`/analyze/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">
          Sequence Analysis,{" "}
          <span className="text-green-400">Powered by AI</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Paste any DNA, RNA, or protein sequence and get instant AI-driven
          insights — ORFs, motifs, gene annotation, and a conversational
          interface to explore your findings.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {["Auto sequence detection", "ORF & motif analysis", "AI annotation", "Chat interface", "Variant impact", "Literature links"].map((f) => (
          <span key={f} className="text-xs text-gray-300 border border-gray-700 bg-gray-800 px-3 py-1 rounded-full">
            {f}
          </span>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex justify-center mb-8">
        <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-1 gap-1">
          <button
            onClick={() => router.push("/")}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "analyze"
                ? "bg-green-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Analyze Sequence
          </button>
          <button
            onClick={() => router.push("/?tab=variant")}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "variant"
                ? "bg-green-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Variant Comparator
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {tab === "analyze" ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <SequenceInput onAnalyze={handleAnalyze} loading={loading} />
            {error && (
              <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <VariantComparator />
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-20 grid md:grid-cols-3 gap-6 text-center max-w-4xl mx-auto">
        {[
          { step: "1", title: "Paste sequence", desc: "DNA, RNA, or protein — we auto-detect the type and clean formatting" },
          { step: "2", title: "Bioinformatics + AI", desc: "Biopython finds ORFs and motifs; Claude annotates function and disease links" },
          { step: "3", title: "Ask questions", desc: "Use the chat interface to explore your sequence interactively" },
        ].map((item) => (
          <div key={item.step} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="w-10 h-10 bg-green-900/50 text-green-400 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">
              {item.step}
            </div>
            <h3 className="text-white font-semibold mb-2">{item.title}</h3>
            <p className="text-gray-400 text-sm">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-400">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
