"use client";

import type { SequenceAnalysisResult } from "@/lib/types";

interface Props {
  result: SequenceAnalysisResult;
}

const TYPE_COLORS: Record<string, string> = {
  DNA:     "text-green-400 bg-green-900/30 border-green-800",
  RNA:     "text-blue-400  bg-blue-900/30  border-blue-800",
  protein: "text-purple-400 bg-purple-900/30 border-purple-800",
  unknown: "text-gray-400  bg-gray-800     border-gray-700",
};

function Badge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-mono font-semibold text-green-300">{value}</p>
    </div>
  );
}

function OrfMap({ orfs, seqLen }: { orfs: SequenceAnalysisResult["bioAnalysis"]["orfs"]; seqLen: number }) {
  if (!orfs || orfs.length === 0) return null;
  return (
    <div>
      <h2 className="text-gray-300 font-medium mb-3">Open Reading Frames</h2>
      {/* Linear map */}
      <div className="relative h-8 bg-gray-900 border border-gray-700 rounded-lg mb-3 overflow-hidden">
        {orfs.slice(0, 10).map((orf, i) => {
          const left = (orf.start / seqLen) * 100;
          const width = Math.max(((orf.end - orf.start) / seqLen) * 100, 0.5);
          return (
            <div
              key={i}
              title={`${orf.strand === "+" ? "+" : "−"} strand · pos ${orf.start}–${orf.end} · ${orf.length} aa`}
              className={`absolute top-1 h-6 rounded cursor-default opacity-80 hover:opacity-100 transition-opacity ${
                orf.strand === "+" ? "bg-green-600" : "bg-orange-500"
              }`}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}
      </div>
      <div className="flex gap-4 text-xs text-gray-500 mb-3">
        <span><span className="inline-block w-3 h-3 bg-green-600 rounded-sm mr-1 align-middle" />+ strand</span>
        <span><span className="inline-block w-3 h-3 bg-orange-500 rounded-sm mr-1 align-middle" />− strand</span>
      </div>
      {/* ORF list */}
      <div className="space-y-2">
        {orfs.slice(0, 5).map((orf, i) => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-4 text-gray-400 text-xs mb-1">
              <span>Pos {orf.start}–{orf.end}</span>
              <span className={orf.strand === "+" ? "text-green-400" : "text-orange-400"}>
                {orf.strand} strand
              </span>
              <span>{orf.length} aa</span>
            </div>
            <p className="font-mono text-green-300 text-xs truncate">{orf.translation}</p>
          </div>
        ))}
        {orfs.length > 5 && (
          <p className="text-xs text-gray-500">+{orfs.length - 5} more ORFs</p>
        )}
      </div>
    </div>
  );
}

function AminoAcidComposition({ comp }: { comp: Record<string, number> }) {
  const total = Object.values(comp).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(comp).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return (
    <div>
      <h2 className="text-gray-300 font-medium mb-3">Amino Acid Composition</h2>
      <div className="space-y-1.5">
        {sorted.map(([aa, count]) => (
          <div key={aa} className="flex items-center gap-2 text-xs">
            <span className="w-6 font-mono text-purple-300 shrink-0">{aa}</span>
            <div className="flex-1 bg-gray-900 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="text-gray-400 w-16 text-right">{count} ({((count / total) * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalysisPanel({ result }: Props) {
  const { bioAnalysis, aiAnnotation } = result;
  const typeStyle = TYPE_COLORS[bioAnalysis.sequenceType] ?? TYPE_COLORS.unknown;

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-green-400 font-semibold text-lg">AI Annotation</h2>
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${typeStyle}`}>
            {bioAnalysis.sequenceType}
          </span>
        </div>
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
          <Badge label="Length" value={`${bioAnalysis.length} ${bioAnalysis.sequenceType === "protein" ? "aa" : "bp"}`} />
          {bioAnalysis.gcContent !== undefined && (
            <Badge label="GC Content" value={`${bioAnalysis.gcContent.toFixed(1)}%`} />
          )}
          {bioAnalysis.orfs && (
            <Badge label="ORFs" value={bioAnalysis.orfs.length} />
          )}
          {bioAnalysis.motifs && (
            <Badge label="Motifs" value={bioAnalysis.motifs.length} />
          )}
        </div>
      </div>

      {/* ORF visualization */}
      <OrfMap orfs={bioAnalysis.orfs} seqLen={bioAnalysis.length} />

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

      {/* Amino acid composition */}
      {bioAnalysis.aminoAcidComposition && Object.keys(bioAnalysis.aminoAcidComposition).length > 0 && (
        <AminoAcidComposition comp={bioAnalysis.aminoAcidComposition} />
      )}

      {/* Translation */}
      {bioAnalysis.translation && (
        <div>
          <h2 className="text-gray-300 font-medium mb-3">Translation (longest ORF)</h2>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-xs text-green-300 break-all">
            {bioAnalysis.translation}
          </div>
        </div>
      )}
    </div>
  );
}
