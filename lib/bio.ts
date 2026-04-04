/**
 * Pure TypeScript bioinformatics — replaces the Python bio-service.
 * Used as fallback when bio-service is unreachable, or as the primary
 * engine when BIO_SERVICE_URL is not set.
 */

import type { BioAnalysis, ORF, Motif } from "./types";

// ── Sequence type detection ───────────────────────────────────────────────────

export function detectSequenceType(seq: string): BioAnalysis["sequenceType"] {
  const chars = new Set(seq.toUpperCase());
  const dna = new Set([..."ATGCN"]);
  const rna = new Set([..."AUGCN"]);
  const protein = new Set([..."ACDEFGHIKLMNPQRSTVWY*"]);

  if (chars.has("U") && [...chars].every((c) => rna.has(c))) return "RNA";
  if ([...chars].every((c) => dna.has(c))) return "DNA";
  if ([...chars].every((c) => protein.has(c)) && chars.size > 5) return "protein";
  return "unknown";
}

// ── GC content ────────────────────────────────────────────────────────────────

export function gcContent(seq: string): number {
  const gc = [...seq].filter((c) => c === "G" || c === "C").length;
  return seq.length ? (gc / seq.length) * 100 : 0;
}

// ── ORF finding ───────────────────────────────────────────────────────────────

const CODON_TABLE: Record<string, string> = {
  TTT:"F",TTC:"F",TTA:"L",TTG:"L",CTT:"L",CTC:"L",CTA:"L",CTG:"L",
  ATT:"I",ATC:"I",ATA:"I",ATG:"M",GTT:"V",GTC:"V",GTA:"V",GTG:"V",
  TCT:"S",TCC:"S",TCA:"S",TCG:"S",CCT:"P",CCC:"P",CCA:"P",CCG:"P",
  ACT:"T",ACC:"T",ACA:"T",ACG:"T",GCT:"A",GCC:"A",GCA:"A",GCG:"A",
  TAT:"Y",TAC:"Y",TAA:"*",TAG:"*",CAT:"H",CAC:"H",CAA:"Q",CAG:"Q",
  AAT:"N",AAC:"N",AAA:"K",AAG:"K",GAT:"D",GAC:"D",GAA:"E",GAG:"E",
  TGT:"C",TGC:"C",TGA:"*",TGG:"W",CGT:"R",CGC:"R",CGA:"R",CGG:"R",
  AGT:"S",AGC:"S",AGA:"R",AGG:"R",GGT:"G",GGC:"G",GGA:"G",GGG:"G",
};

function translate(seq: string): string {
  let prot = "";
  for (let i = 0; i + 2 < seq.length; i += 3) {
    prot += CODON_TABLE[seq.slice(i, i + 3)] ?? "X";
  }
  return prot;
}

function reverseComplement(seq: string): string {
  const comp: Record<string, string> = { A:"T", T:"A", G:"C", C:"G", N:"N" };
  return seq.split("").reverse().map((c) => comp[c] ?? c).join("");
}

export function findORFs(seq: string, minLengthNt = 100): ORF[] {
  const results: ORF[] = [];

  for (const [strand, nuc] of [[1, seq], [-1, reverseComplement(seq)]] as [number, string][]) {
    for (let frame = 0; frame < 3; frame++) {
      const trans = translate(nuc.slice(frame));
      let inOrf = false;
      let startAa = 0;

      const emit = (endAa: number) => {
        const len = endAa - startAa;
        if (len * 3 < minLengthNt) return;
        const ntStart = strand === 1
          ? frame + startAa * 3
          : seq.length - frame - endAa * 3;
        const ntEnd = strand === 1
          ? frame + endAa * 3
          : seq.length - frame - startAa * 3;
        results.push({
          start: ntStart,
          end: ntEnd,
          strand: strand === 1 ? "+" : "-",
          length: len,
          translation: trans.slice(startAa, endAa),
        });
      };

      for (let i = 0; i < trans.length; i++) {
        if (trans[i] === "M" && !inOrf) { inOrf = true; startAa = i; }
        else if (trans[i] === "*" && inOrf) { emit(i); inOrf = false; }
      }
      if (inOrf) emit(trans.length); // flush open ORF at end
    }
  }

  return results.sort((a, b) => b.length - a.length).slice(0, 10);
}

// ── Motif detection ───────────────────────────────────────────────────────────

const MOTIFS: Record<string, Record<string, string>> = {
  DNA: {
    "TATA box":          "TATAAA",
    "Kozak sequence":    "GCCACCATG",
    "Poly-A signal":     "AATAAA",
    "CpG dinucleotide":  "CG",
    "BamHI site":        "GGATCC",
    "EcoRI site":        "GAATTC",
    "HindIII site":      "AAGCTT",
  },
  RNA: {
    "Kozak sequence":    "GCCACCAUG",
    "Poly-A signal":     "AAUAAA",
    "Shine-Dalgarno":    "AGGAGG",
  },
  protein: {
    "RGD motif":         "RGD",
    "NLS signal":        "KKKRKV",
    "N-glycosylation":   "N[^P][ST]",
    "PKA site":          "R[RK].[ST]",
  },
};

export function findMotifs(seq: string, type: string): Motif[] {
  const dict = MOTIFS[type] ?? {};
  const found: Motif[] = [];
  for (const [name, pattern] of Object.entries(dict)) {
    try {
      const positions: number[] = [];
      const re = new RegExp(pattern, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(seq)) !== null) positions.push(m.index);
      if (positions.length) found.push({ name, pattern, positions });
    } catch { /* skip bad patterns */ }
  }
  return found;
}

// ── Simple sequence repeats ───────────────────────────────────────────────────

export function findRepeats(seq: string) {
  const found: Array<{ sequence: string; count: number; positions: number[] }> = [];
  for (let unitLen = 2; unitLen <= 6; unitLen++) {
    const re = new RegExp(`(.{${unitLen}})\\1{2,}`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(seq)) !== null) {
      const unit = m[1];
      const count = Math.floor(m[0].length / unitLen);
      found.push({ sequence: unit, count, positions: [m.index] });
    }
  }
  return found.slice(0, 10);
}

// ── Amino acid composition ────────────────────────────────────────────────────

export function aminoAcidComposition(seq: string): Record<string, number> {
  const comp: Record<string, number> = {};
  for (const aa of seq.replace(/\*/g, "")) {
    comp[aa] = (comp[aa] ?? 0) + 1;
  }
  return comp;
}

// ── Full analysis pipeline ────────────────────────────────────────────────────

export function analyzeSequenceTS(sequence: string): BioAnalysis {
  const seq = sequence.toUpperCase().replace(/\s/g, "");
  const seqType = detectSequenceType(seq);
  const result: BioAnalysis = { sequenceType: seqType, length: seq.length };

  if (seqType === "DNA" || seqType === "RNA") {
    result.gcContent = gcContent(seq);
    if (seqType === "DNA") {
      result.orfs = findORFs(seq);
      if (result.orfs.length) result.translation = result.orfs[0].translation;
    }
  } else if (seqType === "protein") {
    result.aminoAcidComposition = aminoAcidComposition(seq);
  }

  result.motifs = findMotifs(seq, seqType);
  result.repeatRegions = findRepeats(seq);
  return result;
}

// ── Variant diff (no alignment, positional) ───────────────────────────────────

export function variantDiffTS(wt: string, mt: string) {
  const minLen = Math.min(wt.length, mt.length);
  const diffPositions = [];
  for (let i = 0; i < minLen; i++) {
    if (wt[i] !== mt[i]) diffPositions.push(i);
  }
  return {
    diff_positions: diffPositions.slice(0, 100),
    num_substitutions: diffPositions.length,
    num_insertions: Math.max(0, mt.length - wt.length),
    num_deletions: Math.max(0, wt.length - mt.length),
    alignment_score: minLen > 0 ? 1 - diffPositions.length / minLen : 0,
  };
}
