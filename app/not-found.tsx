export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-6xl font-mono text-gray-700 mb-4">404</p>
      <h1 className="text-xl font-semibold text-white mb-2">Analysis not found</h1>
      <p className="text-gray-400 text-sm mb-8">
        This analysis ID doesn't exist or has been removed.
      </p>
      <a
        href="/"
        className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Start a new analysis
      </a>
    </div>
  );
}
