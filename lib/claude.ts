import Anthropic from "@anthropic-ai/sdk";
import type { BioAnalysis, ChatMessage } from "./types";
import { getEnv } from "@/lib/env";

// Lazy-initialize so a missing/empty API key doesn't crash module import
let _claude: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_claude) {
    const key = getEnv("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
    _claude = new Anthropic({ apiKey: key });
  }
  return _claude;
}

const BIO_SYSTEM_PROMPT = `You are BioSeq AI, an expert bioinformatics assistant specializing in DNA, RNA, and protein sequence analysis. You have deep knowledge of molecular biology, genomics, proteomics, and structural biology.

When analyzing sequences:
- Be precise and scientifically accurate
- Use standard nomenclature (HGNC gene names, UniProt identifiers, etc.)
- Cite relevant biological context
- Explain findings in plain English while maintaining scientific rigor
- Flag uncertainties clearly

You assist wet-lab biologists who may not have computational expertise.`;

/** Strip markdown fences then extract the first JSON object. */
export function parseJsonResponse<T>(text: string, fallback: T): T {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  try {
    return match ? JSON.parse(match[0]) : fallback;
  } catch {
    return fallback;
  }
}

export async function annotateSequence(
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
  const stream = getClient().messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    thinking: { type: "enabled", budget_tokens: 1024 },
    system: BIO_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this ${bioAnalysis.sequenceType} sequence and provide biological annotation.

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
      },
    ],
  });

  const response = await stream.finalMessage();
  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  return parseJsonResponse(text, { summary: text });
}

export async function* streamChat(
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

  // Cap history to last 20 messages (10 turns) to stay within context limits
  const recentHistory = history.slice(-20);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: contextBlock },
    { role: "assistant", content: "I have reviewed the sequence and its analysis. How can I help you?" },
    ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const stream = getClient().messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: BIO_SYSTEM_PROMPT,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

export async function analyzeVariant(
  wildType: string,
  mutant: string,
  sequenceType: string
): Promise<{
  impact: string;
  score: number;
  explanation: string;
  conservedPositions?: number[];
}> {
  const response = await getClient().messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    thinking: { type: "enabled", budget_tokens: 1024 },
    system: BIO_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Compare this ${sequenceType} wild-type vs mutant sequence and predict functional impact.

Wild-type: ${wildType.slice(0, 500)}
Mutant:    ${mutant.slice(0, 500)}

Identify differences and assess likely functional impact. Respond in JSON:
{
  "impact": "benign|likely_benign|uncertain|likely_deleterious|deleterious",
  "score": 0.0-1.0,
  "explanation": "detailed explanation of predicted impact",
  "conservedPositions": [list of position numbers that appear highly conserved]
}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  return parseJsonResponse(text, { impact: "uncertain", score: 0.5, explanation: text });
}
