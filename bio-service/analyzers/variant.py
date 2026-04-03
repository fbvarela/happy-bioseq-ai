"""Variant comparison utilities."""

from Bio import pairwise2
from Bio.pairwise2 import format_alignment


def align_and_diff(wild_type: str, mutant: str) -> dict:
    """Align two sequences and identify differing positions."""
    wt = wild_type.upper()
    mt = mutant.upper()

    # If same length, simple positional diff
    if len(wt) == len(mt):
        diff_positions = [i for i in range(len(wt)) if wt[i] != mt[i]]
        return {
            "diff_positions": diff_positions,
            "num_substitutions": len(diff_positions),
            "num_insertions": 0,
            "num_deletions": 0,
            "alignment_score": 1.0 - len(diff_positions) / len(wt),
        }

    # Pairwise alignment for indels
    try:
        alignments = pairwise2.align.globalms(wt, mt, 2, -1, -5, -0.5, one_alignment_only=True)
        if not alignments:
            return {"diff_positions": [], "alignment_score": 0.0}

        aln = alignments[0]
        aligned_wt = aln.seqA
        aligned_mt = aln.seqB

        diff_positions = []
        real_pos = 0
        for i, (a, b) in enumerate(zip(aligned_wt, aligned_mt)):
            if a != b:
                diff_positions.append(real_pos)
            if a != "-":
                real_pos += 1

        max_score = 2.0 * max(len(wt), len(mt))
        norm_score = aln.score / max_score if max_score > 0 else 0.0

        return {
            "diff_positions": diff_positions[:100],  # cap at 100
            "num_substitutions": sum(1 for a, b in zip(aligned_wt, aligned_mt) if a != "-" and b != "-" and a != b),
            "num_insertions": aligned_mt.count("-"),
            "num_deletions": aligned_wt.count("-"),
            "alignment_score": float(max(0, min(1, norm_score))),
        }
    except Exception:
        # Fallback: character-level diff at common length
        min_len = min(len(wt), len(mt))
        diff_positions = [i for i in range(min_len) if wt[i] != mt[i]]
        return {
            "diff_positions": diff_positions,
            "alignment_score": 1.0 - len(diff_positions) / min_len if min_len > 0 else 0.0,
        }
