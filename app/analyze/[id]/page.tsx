import { notFound } from "next/navigation";
import { getAnalysis, getChatHistory } from "@/lib/db";
import AnalysisPanel from "@/components/AnalysisPanel";
import AnalyzePageClient from "@/components/AnalyzePageClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AnalyzePage({ params }: Props) {
  const { id } = await params;

  let result;
  let history;
  try {
    [result, history] = await Promise.all([
      getAnalysis(id),
      getChatHistory(id),
    ]);
  } catch {
    // DB might not be configured — show a not-found
    notFound();
  }

  if (!result) notFound();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <a href="/" className="text-gray-400 hover:text-white text-sm transition-colors">
              ← New analysis
            </a>
            <span className="text-gray-600">·</span>
            <span className="text-xs font-mono text-gray-500">{result.id}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {result.bioAnalysis.sequenceType} Sequence Analysis
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {result.bioAnalysis.length} {result.bioAnalysis.sequenceType === "protein" ? "amino acids" : "base pairs"} ·{" "}
            {new Date(result.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-3 py-1 rounded-full font-mono">
            {result.rawSequence.slice(0, 20)}…
          </span>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Analysis */}
        <div>
          <AnalysisPanel result={result} />
        </div>

        {/* Right: Chat + Literature */}
        <div>
          <AnalyzePageClient
            analysisId={result.id}
            initialHistory={history}
            annotation={result.aiAnnotation}
          />
        </div>
      </div>

      {/* Raw sequence toggle */}
      <details className="mt-6 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <summary className="px-5 py-3 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors">
          Raw sequence ({result.rawSequence.length} chars)
        </summary>
        <div className="px-5 pb-4">
          <pre className="font-mono text-xs text-green-300 bg-gray-950 rounded-lg p-4 overflow-auto max-h-48 whitespace-pre-wrap break-all">
            {result.rawSequence}
          </pre>
        </div>
      </details>
    </div>
  );
}
