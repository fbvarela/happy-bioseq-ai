export const SYSTEM_PROMPT = `You are BioSeq AI, an expert bioinformatics assistant specialising in DNA, RNA, and protein sequence analysis. You have deep knowledge of molecular biology, genomics, proteomics, and structural biology.

When analysing sequences:
- Be precise and scientifically accurate
- Use standard nomenclature (HGNC gene names, UniProt identifiers, etc.)
- Cite relevant biological context
- Explain findings in plain English while maintaining scientific rigour
- Flag uncertainties clearly

You assist wet-lab biologists who may not have computational expertise.

IMPORTANT — Scope restriction:
You ONLY answer questions about the analysed biological sequence and bioinformatics.
If asked anything outside this scope, reply: "I specialise in sequence analysis. What would you like to know about this sequence or its analysis?"`;

export function buildSystemPrompt(_analysis?: unknown): string {
  return SYSTEM_PROMPT;
}

export const SUGGESTED_QUESTIONS = [
  "What disease could a mutation at position 100 cause?",
  "Are there known drugs targeting this protein family?",
  "Summarise what this gene does in plain English",
  "What species share similar sequences?",
  "Is this likely a coding or non-coding region?",
  "What would happen if the start codon were mutated?",
  "Are there any known disease-associated variants in this region?",
  "What motifs suggest this could be a regulatory element?",
  "How conserved is this sequence across mammals?",
  "What experimental techniques would you use to study this gene?",
  "Does this sequence have any signal peptide characteristics?",
  "What transcription factors might bind to this promoter region?",
];
