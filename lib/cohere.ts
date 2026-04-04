import { CohereClient } from "cohere-ai";
import type { BioAnalysis, ChatMessage } from "./types";

export const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const BIO_PREAMBLE = `You are BioSeq AI, an expert bioinformatics assistant specializing in DNA, RNA, and protein sequence analysis. You have deep knowledge of molecular biology, genomics, proteomics, and structural biology.

When analyzing sequences:
- Be precise and scientifically accurate
- Use standard nomenclature (HGNC gene names, UniProt identifiers, etc.)
- Cite relevant biological context
- Explain findings in plain English while maintaining scientific rigor
- Flag uncertainties clearly

You assist wet-lab biologists who may not have computational expertise.`;

export async function annotateSequenceCohere(
  sequence: string,
  bioAnalysis: BioAnalysis
): Promise<{
  summary: string;
  potentialGene?: string;
  proteinFamily?: string;
  biologicalFunction?: string;
  diseaseAssociations?: string[];
  structuralFeatures?: string[];
}> {
  const response = await cohere.chat({
    model: "command-r-plus",
    preamble: BIO_PREAMBLE,
    responseFormat: { type: "json_object" },
    message: `Analyze this ${bioAnalysis.sequenceType} sequence and provide biological annotation.

Sequence (${bioAnalysis.length} bp/aa):
${sequence.slice(0, 2000)}${sequence.length > 2000 ? "... [truncated]" : ""}

Bioinformatics results:
- GC Content: ${bioAnalysis.gcContent?.toFixed(1) ?? "N/A"}%
- ORFs found: ${bioAnalysis.orfs?.length ?? 0}
- Motifs detected: ${bioAnalysis.motifs?.map((m) => m.name).join(", ") || "none"}
${bioAnalysis.translation ? `- Translation: ${bioAnalysis.translation.slice(0, 200)}...` : ""}

Respond in JSON format:
{
  "summary": "2-3 sentence plain-English summary",
  "potentialGene": "gene name or null",
  "proteinFamily": "protein family or null",
  "biologicalFunction": "likely function description or null",
  "diseaseAssociations": ["disease1", "disease2"] or [],
  "structuralFeatures": ["feature1", "feature2"] or []
}`,
  });

  const text = response.text ?? "{}";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text };
  } catch {
    return { summary: text };
  }
}

export async function* streamChatCohere(
  sequence: string,
  bioAnalysis: BioAnalysis,
  annotation: object,
  history: ChatMessage[],
  userMessage: string
): AsyncGenerator<string> {
  const contextBlock = `SEQUENCE CONTEXT:
Type: ${bioAnalysis.sequenceType}
Length: ${bioAnalysis.length} residues
GC Content: ${bioAnalysis.gcContent?.toFixed(1) ?? "N/A"}%
ORFs: ${bioAnalysis.orfs?.length ?? 0} found
Annotation summary: ${(annotation as { summary?: string }).summary ?? "none"}

Raw sequence (first 500 chars): ${sequence.slice(0, 500)}`;

  const chatHistory = [
    { role: "USER" as const, message: contextBlock },
    { role: "CHATBOT" as const, message: "I have reviewed the sequence and its analysis. How can I help you?" },
    ...history.map((m) => ({
      role: m.role === "user" ? ("USER" as const) : ("CHATBOT" as const),
      message: m.content,
    })),
  ];

  const stream = await cohere.chatStream({
    model: "command-r-plus",
    preamble: BIO_PREAMBLE,
    chatHistory,
    message: userMessage,
  });

  for await (const event of stream) {
    if (event.eventType === "text-generation") {
      yield event.text;
    }
  }
}

export async function analyzeVariantCohere(
  wildType: string,
  mutant: string,
  sequenceType: string
): Promise<{
  impact: string;
  score: number;
  explanation: string;
  conservedPositions?: number[];
}> {
  const response = await cohere.chat({
    model: "command-r-plus",
    preamble: BIO_PREAMBLE,
    responseFormat: { type: "json_object" },
    message: `Compare this ${sequenceType} wild-type vs mutant sequence and predict functional impact.

Wild-type: ${wildType.slice(0, 500)}
Mutant:    ${mutant.slice(0, 500)}

Identify differences and assess likely functional impact. Respond in JSON:
{
  "impact": "benign|likely_benign|uncertain|likely_deleterious|deleterious",
  "score": 0.0-1.0,
  "explanation": "detailed explanation of predicted impact",
  "conservedPositions": [list of position numbers that appear highly conserved]
}`,
  });

  const text = response.text ?? "{}";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { impact: "uncertain", score: 0.5, explanation: text };
  } catch {
    return { impact: "uncertain", score: 0.5, explanation: text };
  }
}
