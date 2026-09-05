import type { BioAnalysis, ChatMessage } from "./types";
import { annotateSequenceCohere, streamChatCohere, analyzeVariantCohere } from "./cohere";

export async function annotateSequenceAI(
  sequence: string,
  bioAnalysis: BioAnalysis
) {
  return annotateSequenceCohere(sequence, bioAnalysis);
}

export async function* streamChatAI(
  sequence: string,
  bioAnalysis: BioAnalysis,
  annotation: object,
  history: ChatMessage[],
  userMessage: string
): AsyncGenerator<string> {
  yield* streamChatCohere(sequence, bioAnalysis, annotation, history, userMessage);
}

export async function analyzeVariantAI(
  wildType: string,
  mutant: string,
  sequenceType: string
) {
  return analyzeVariantCohere(wildType, mutant, sequenceType);
}
