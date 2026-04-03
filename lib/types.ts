export type SequenceType = "DNA" | "RNA" | "protein" | "unknown";

export interface ORF {
  start: number;
  end: number;
  strand: "+" | "-";
  length: number;
  translation: string;
}

export interface Motif {
  name: string;
  pattern: string;
  positions: number[];
}

export interface BioAnalysis {
  sequenceType: SequenceType;
  length: number;
  gcContent?: number;
  orfs?: ORF[];
  motifs?: Motif[];
  translation?: string;
  aminoAcidComposition?: Record<string, number>;
  repeatRegions?: Array<{ sequence: string; count: number; positions: number[] }>;
}

export interface AIAnnotation {
  summary: string;
  potentialGene?: string;
  proteinFamily?: string;
  biologicalFunction?: string;
  diseaseAssociations?: string[];
  structuralFeatures?: string[];
}

export interface SequenceAnalysisResult {
  id: string;
  rawSequence: string;
  bioAnalysis: BioAnalysis;
  aiAnnotation: AIAnnotation;
  createdAt: string;
}

export interface VariantAnalysis {
  position: number;
  wildType: string;
  mutant: string;
  impact: "benign" | "likely_benign" | "uncertain" | "likely_deleterious" | "deleterious";
  score: number;
  explanation: string;
  conservedPositions?: number[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LiteratureResult {
  pubmedId: string;
  title: string;
  abstract: string;
  relevanceScore: number;
  url: string;
}
