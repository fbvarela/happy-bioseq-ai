import type { BioAnalysis, ChatMessage } from "./types";
import { annotateSequence, streamChat, analyzeVariant } from "./claude";
import { annotateSequenceCohere, streamChatCohere, analyzeVariantCohere } from "./cohere";

export type AIProvider = "claude" | "cohere";

export function resolveProvider(requested?: string): AIProvider {
  const p = (requested ?? process.env.AI_PROVIDER ?? "").toLowerCase();
  return p === "cohere" ? "cohere" : "claude";
}

export async function annotateSequenceAI(
  sequence: string,
  bioAnalysis: BioAnalysis,
  provider?: string
) {
  return resolveProvider(provider) === "cohere"
    ? annotateSequenceCohere(sequence, bioAnalysis)
    : annotateSequence(sequence, bioAnalysis);
}

export async function* streamChatAI(
  sequence: string,
  bioAnalysis: BioAnalysis,
  annotation: object,
  history: ChatMessage[],
  userMessage: string,
  provider?: string
): AsyncGenerator<string> {
  const gen =
    resolveProvider(provider) === "cohere"
      ? streamChatCohere(sequence, bioAnalysis, annotation, history, userMessage)
      : streamChat(sequence, bioAnalysis, annotation, history, userMessage);

  for await (const chunk of gen) {
    yield chunk;
  }
}

export async function analyzeVariantAI(
  wildType: string,
  mutant: string,
  sequenceType: string,
  provider?: string
) {
  return resolveProvider(provider) === "cohere"
    ? analyzeVariantCohere(wildType, mutant, sequenceType)
    : analyzeVariant(wildType, mutant, sequenceType);
}
