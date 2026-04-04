"""Biopython-based sequence analysis."""

from Bio.Seq import Seq
from Bio.SeqUtils import gc_fraction
from Bio.SeqUtils.ProtParam import ProteinAnalysis
import re


MOTIFS = {
    "DNA": {
        "TATA box": "TATAAA",
        "Kozak sequence": "GCCACCATG",
        "Poly-A signal": "AATAAA",
        "CpG dinucleotide": "CG",
        "BamHI site": "GGATCC",
        "EcoRI site": "GAATTC",
        "HindIII site": "AAGCTT",
    },
    "RNA": {
        "Kozak sequence": "GCCACCAUG",
        "Poly-A signal": "AAUAAA",
        "Shine-Dalgarno": "AGGAGG",
    },
    "protein": {
        "RGD motif": "RGD",
        "NLS signal": "KKKRKV",
        "N-glycosylation": "N[^P][ST]",
        "PKA site": "R[RK].[ST]",
        "CAAX prenylation": "C[A-Z]{2}[AFIM]$",
    },
}


def detect_sequence_type(sequence: str) -> str:
    chars = set(sequence.upper())
    dna_only = chars <= {"A", "T", "G", "C", "N"}
    rna_only = chars <= {"A", "U", "G", "C", "N"}
    protein_chars = set("ACDEFGHIKLMNPQRSTVWY*")
    protein_only = chars <= protein_chars

    if "U" in chars and rna_only:
        return "RNA"
    if dna_only:
        return "DNA"
    if protein_only and len(chars) > 5:
        return "protein"
    return "unknown"


def find_orfs(sequence: str, min_length: int = 100) -> list[dict]:
    """Find all ORFs in all 6 reading frames."""
    seq = Seq(sequence)
    orfs = []

    for strand, nuc in [(+1, seq), (-1, seq.reverse_complement())]:
        for frame in range(3):
            trans = str(nuc[frame:].translate())
            aa_start = 0
            in_orf = False
            start_pos = 0

            for i, aa in enumerate(trans):
                if aa == "M" and not in_orf:
                    in_orf = True
                    start_pos = i
                elif aa == "*" and in_orf:
                    length = i - start_pos
                    if length * 3 >= min_length:
                        nt_start = frame + start_pos * 3
                        nt_end = frame + i * 3
                        if strand == -1:
                            nt_start = len(sequence) - nt_end
                            nt_end = len(sequence) - frame - start_pos * 3

                        orfs.append({
                            "start": int(nt_start),
                            "end": int(nt_end),
                            "strand": "+" if strand == 1 else "-",
                            "length": int(length),
                            "translation": trans[start_pos:i],
                        })
                    in_orf = False

    orfs.sort(key=lambda x: x["length"], reverse=True)
    return orfs[:10]  # top 10 by length


def find_motifs(sequence: str, seq_type: str) -> list[dict]:
    """Find known biological motifs."""
    found = []
    motif_dict = MOTIFS.get(seq_type, {})

    for name, pattern in motif_dict.items():
        try:
            positions = [m.start() for m in re.finditer(pattern, sequence, re.IGNORECASE)]
            if positions:
                found.append({
                    "name": name,
                    "pattern": pattern,
                    "positions": positions,
                })
        except re.error:
            pass

    return found


def find_repeats(sequence: str, min_repeat: int = 3, min_unit: int = 2) -> list[dict]:
    """Find simple sequence repeats (SSRs/microsatellites)."""
    repeats = []
    for unit_len in range(min_unit, 7):
        pattern = rf"(.{{{unit_len}}})\1{{{min_repeat - 1},}}"
        for match in re.finditer(pattern, sequence):
            unit = match.group(1)
            count = len(match.group(0)) // unit_len
            repeats.append({
                "sequence": unit,
                "count": int(count),
                "positions": [match.start()],
            })
    return repeats[:10]


def analyze_sequence(sequence: str) -> dict:
    """Full sequence analysis pipeline."""
    seq = sequence.upper().replace(" ", "").replace("\n", "")
    seq_type = detect_sequence_type(seq)

    result: dict = {
        "sequenceType": seq_type,
        "length": len(seq),
    }

    if seq_type in ("DNA", "RNA"):
        bio_seq = Seq(seq)
        result["gcContent"] = round(gc_fraction(bio_seq) * 100, 2)

        if seq_type == "DNA":
            result["orfs"] = find_orfs(seq)
            # Translate the longest ORF
            if result["orfs"]:
                result["translation"] = result["orfs"][0]["translation"]

    elif seq_type == "protein":
        try:
            # Filter out stop codons for ProteinAnalysis
            clean_prot = seq.replace("*", "")
            pa = ProteinAnalysis(clean_prot)
            aa_comp = pa.count_amino_acids()
            result["aminoAcidComposition"] = {
                k: int(v) for k, v in aa_comp.items() if v > 0
            }
        except Exception:
            pass

    result["motifs"] = find_motifs(seq, seq_type)
    result["repeatRegions"] = find_repeats(seq)

    return result
