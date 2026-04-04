import type { BioAnalysis, ChatMessage } from "./types";
import { annotateSequence, streamChat, analyzeVariant } from "./claude";
import { annotateSequenceCohere, streamChatCohere, analyzeVariantCohere } from "./cohere";

export type AIProvider = "claude" | "cohere";

export function getProvider(): AIProvider {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  return p === "cohere" ? "cohere" : "claude";
}

export async function annotateSequenceAI(
  sequence: string,
  bioAnalysis: BioAnalysis
) {
  return getProvider() === "cohere"
    ? annotateSequenceCohere(sequence, bioAnalysis)
    : annotateSequence(sequence, bioAnalysis);
}

export async function* streamChatAI(
  sequence: string,
  bioAnalysis: BioAnalysis,
  annotation: object,
  history: ChatMessage[],
  userMessage: string
): AsyncGenerator<string> {
  const gen =
    getProvider() === "cohere"
      ? streamChatCohere(sequence, bioAnalysis, annotation, history, userMessage)
      : streamChat(sequence, bioAnalysis, annotation, history, userMessage);

  for await (const chunk of gen) {
    yield chunk;
  }
}

export async function analyzeVariantAI(
  wildType: string,
  mutant: string,
  sequenceType: string
) {
  return getProvider() === "cohere"
    ? analyzeVariantCohere(wildType, mutant, sequenceType)
    : analyzeVariant(wildType, mutant, sequenceType);
}
