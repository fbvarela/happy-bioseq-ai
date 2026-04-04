"use client";

import { useProvider } from "@/components/ProviderContext";
import ChatInterface from "@/components/ChatInterface";
import type { ChatMessage, AIAnnotation } from "@/lib/types";
import LiteraturePanel from "@/components/LiteraturePanel";

interface Props {
  analysisId: string;
  initialHistory: ChatMessage[];
  annotation: AIAnnotation;
}

export default function AnalyzePageClient({ analysisId, initialHistory, annotation }: Props) {
  const { provider } = useProvider();
  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-white font-semibold">AI Research Assistant</h2>
          </div>
          <span className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full capitalize">
            {provider}
          </span>
        </div>
        <ChatInterface
          analysisId={analysisId}
          initialHistory={initialHistory}
          provider={provider}
        />
      </div>
      <div className="mt-6">
        <LiteraturePanel analysisId={analysisId} annotation={annotation} />
      </div>
    </>
  );
}
