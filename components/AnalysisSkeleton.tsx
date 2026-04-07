export default function AnalysisSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-4 w-24 bg-gray-800 rounded" />
        <div className="h-4 w-32 bg-gray-800 rounded" />
      </div>
      <div className="h-7 w-64 bg-gray-800 rounded mb-8" />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <div className="h-5 w-32 bg-gray-800 rounded" />
            <div className="h-4 w-full bg-gray-800 rounded" />
            <div className="h-4 w-5/6 bg-gray-800 rounded" />
            <div className="h-4 w-4/6 bg-gray-800 rounded" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-900 border border-gray-800 rounded-lg" />
            ))}
          </div>
          <div className="h-32 bg-gray-900 border border-gray-800 rounded-xl" />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
          <div className="h-5 w-40 bg-gray-800 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
