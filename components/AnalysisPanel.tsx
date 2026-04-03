"use client";

import type { SequenceAnalysisResult } from "@/lib/types";

interface Props {
  result: SequenceAnalysisResult;
}

const IMPACT_COLORS: Record<string, string> = {
  benign: "text-green-400",
  likely_benign: "text-green-500",
  uncertain: "text-yellow-400",
  likely_deleterious: "text-orange-400",
  deleterious: "text-red-400",
};

function Badge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-mono font-semibold text-green-300">{value}</p>
    </div>
  );
}

export default function AnalysisPanel({ result }: Props) {
  const { bioAnalysis, aiAnnotation } = result;

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <h2 className="text-green-400 font-semibold text-lg mb-2">AI Annotation</h2>
        <p className="text-gray-200 leading-relaxed">{aiAnnotation.summary}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {aiAnnotation.potentialGene && (
            <div>
              <span className="text-gray-400">Gene: </span>
              <span className="text-white font-mono">{aiAnnotation.potentialGene}</span>
            </div>
          )}
          {aiAnnotation.proteinFamily && (
            <div>
              <span className="text-gray-400">Family: </span>
              <span className="text-white">{aiAnnotation.proteinFamily}</span>
            </div>
          )}
          {aiAnnotation.biologicalFunction && (
            <div className="col-span-2">
              <span className="text-gray-400">Function: </span>
              <span className="text-white">{aiAnnotation.biologicalFunction}</span>
            </div>
          )}
        </div>

        {aiAnnotation.diseaseAssociations && aiAnnotation.diseaseAssociations.length > 0 && (
          <div className="mt-3">
            <p className="text-gray-400 text-xs mb-1">Disease Associations</p>
            <div className="flex flex-wrap gap-2">
              {aiAnnotation.diseaseAssociations.map((d) => (
                <span key={d} className="text-xs bg-red-900/40 text-red-300 border border-red-800 px-2 py-0.5 rounded-full">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {aiAnnotation.structuralFeatures && aiAnnotation.structuralFeatures.length > 0 && (
          <div className="mt-3">
            <p className="text-gray-400 text-xs mb-1">Structural Features</p>
            <div className="flex flex-wrap gap-2">
              {aiAnnotation.structuralFeatures.map((f) => (
                <span key={f} className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bioinformatics Stats */}
      <div>
        <h2 className="text-gray-300 font-medium mb-3">Sequence Properties</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Badge label="Type" value={bioAnalysis.sequenceType} />
          <Badge label="Length" value={`${bioAnalysis.length} ${bioAnalysis.sequenceType === "protein" ? "aa" : "bp"}`} />
          {bioAnalysis.gcContent !== undefined && (
            <Badge label="GC Content" value={`${bioAnalysis.gcContent.toFixed(1)}%`} />
          )}
          {bioAnalysis.orfs && (
            <Badge label="ORFs" value={bioAnalysis.orfs.length} />
          )}
        </div>
      </div>

      {/* ORFs */}
      {bioAnalysis.orfs && bioAnalysis.orfs.length > 0 && (
        <div>
          <h2 className="text-gray-300 font-medium mb-3">Open Reading Frames</h2>
          <div className="space-y-2">
            {bioAnalysis.orfs.slice(0, 5).map((orf, i) => (
              <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-4 text-gray-400 text-xs mb-1">
                  <span>Pos {orf.start}–{orf.end}</span>
                  <span>Strand {orf.strand}</span>
                  <span>{orf.length} aa</span>
                </div>
                <p className="font-mono text-green-300 text-xs truncate">{orf.translation}</p>
              </div>
            ))}
            {bioAnalysis.orfs.length > 5 && (
              <p className="text-xs text-gray-500">+{bioAnalysis.orfs.length - 5} more ORFs</p>
            )}
          </div>
        </div>
      )}

      {/* Motifs */}
      {bioAnalysis.motifs && bioAnalysis.motifs.length > 0 && (
        <div>
          <h2 className="text-gray-300 font-medium mb-3">Detected Motifs</h2>
          <div className="space-y-2">
            {bioAnalysis.motifs.map((motif, i) => (
              <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center justify-between text-sm">
                <div>
                  <span className="text-white font-medium">{motif.name}</span>
                  <span className="text-gray-400 ml-2 font-mono text-xs">{motif.pattern}</span>
                </div>
                <span className="text-gray-400 text-xs">{motif.positions.length} hit{motif.positions.length !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Translation */}
      {bioAnalysis.translation && (
        <div>
          <h2 className="text-gray-300 font-medium mb-3">Translation</h2>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-xs text-green-300 break-all">
            {bioAnalysis.translation}
          </div>
        </div>
      )}
    </div>
  );
}
