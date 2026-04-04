import { getRecentAnalyses } from "@/lib/db";

const TYPE_BADGE: Record<string, string> = {
  DNA:     "text-green-400 border-green-800 bg-green-900/20",
  RNA:     "text-blue-400  border-blue-800  bg-blue-900/20",
  protein: "text-purple-400 border-purple-800 bg-purple-900/20",
  unknown: "text-gray-400  border-gray-700  bg-gray-800",
};

export default async function HistoryPage() {
  let analyses: Awaited<ReturnType<typeof getRecentAnalyses>> = [];
  try {
    analyses = await getRecentAnalyses(20);
  } catch {
    // DB not yet initialized
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Recent Analyses</h1>
        <p className="text-gray-400 text-sm">Last 20 sequences analyzed</p>
      </div>

      {analyses.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="mb-2">No analyses yet.</p>
          <a href="/" className="text-green-500 hover:text-green-400 text-sm">
            Analyze your first sequence →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a) => (
            <a
              key={a.id}
              href={`/analyze/${a.id}`}
              className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${TYPE_BADGE[a.sequenceType] ?? TYPE_BADGE.unknown}`}>
                      {a.sequenceType}
                    </span>
                    <span className="text-xs text-gray-500">{a.length} {a.sequenceType === "protein" ? "aa" : "bp"}</span>
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">{a.summary}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs font-mono text-gray-600 mt-1">{a.id.slice(0, 8)}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
