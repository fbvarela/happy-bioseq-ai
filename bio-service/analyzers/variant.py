"""Variant comparison utilities."""

from Bio.Align import PairwiseAligner


def _reconstruct_aligned(seq1: str, seq2: str, aligned) -> tuple[str, str]:
    """Reconstruct gap-inclusive strings from PairwiseAligner coordinate blocks."""
    # aligned[0] → (start, end) blocks for seq1 (target)
    # aligned[1] → (start, end) blocks for seq2 (query)
    out1, out2 = "", ""
    pos1, pos2 = 0, 0

    for (s1, e1), (s2, e2) in zip(aligned[0], aligned[1]):
        gap1 = s1 - pos1  # unaligned residues in seq1 before this block
        gap2 = s2 - pos2  # unaligned residues in seq2 before this block
        if gap1 > 0:
            out1 += seq1[pos1:s1]
            out2 += "-" * gap1
        if gap2 > 0:
            out1 += "-" * gap2
            out2 += seq2[pos2:s2]
        out1 += seq1[s1:e1]
        out2 += seq2[s2:e2]
        pos1, pos2 = e1, e2

    # Trailing unaligned residues
    if pos1 < len(seq1):
        out1 += seq1[pos1:]
        out2 += "-" * (len(seq1) - pos1)
    if pos2 < len(seq2):
        out1 += "-" * (len(seq2) - pos2)
        out2 += seq2[pos2:]

    return out1, out2


def align_and_diff(wild_type: str, mutant: str) -> dict:
    """Align two sequences and identify differing positions."""
    wt = wild_type.upper()
    mt = mutant.upper()

    # Same length: simple positional diff, no alignment needed
    if len(wt) == len(mt):
        diff_positions = [i for i in range(len(wt)) if wt[i] != mt[i]]
        return {
            "diff_positions": diff_positions,
            "num_substitutions": len(diff_positions),
            "num_insertions": 0,
            "num_deletions": 0,
            "alignment_score": 1.0 - len(diff_positions) / len(wt),
        }

    # Different lengths: global pairwise alignment
    try:
        aligner = PairwiseAligner()
        aligner.mode = "global"
        aligner.match_score = 2
        aligner.mismatch_score = -1
        aligner.open_gap_score = -5
        aligner.extend_gap_score = -0.5

        alignments = aligner.align(wt, mt)
        aln = next(iter(alignments), None)
        if aln is None:
            return {"diff_positions": [], "alignment_score": 0.0}

        aligned_wt, aligned_mt = _reconstruct_aligned(wt, mt, aln.aligned)

        diff_positions: list[int] = []
        real_pos = 0
        num_substitutions = 0
        for a, b in zip(aligned_wt, aligned_mt):
            if a != b:
                diff_positions.append(real_pos)
                if a != "-" and b != "-":
                    num_substitutions += 1
            if a != "-":
                real_pos += 1

        num_insertions = aligned_wt.count("-")
        num_deletions = aligned_mt.count("-")
        max_score = 2.0 * max(len(wt), len(mt))
        norm_score = float(aln.score) / max_score if max_score > 0 else 0.0

        return {
            "diff_positions": diff_positions[:100],
            "num_substitutions": num_substitutions,
            "num_insertions": num_insertions,
            "num_deletions": num_deletions,
            "alignment_score": float(max(0.0, min(1.0, norm_score))),
        }
    except Exception:
        min_len = min(len(wt), len(mt))
        diff_positions = [i for i in range(min_len) if wt[i] != mt[i]]
        return {
            "diff_positions": diff_positions,
            "alignment_score": 1.0 - len(diff_positions) / min_len if min_len > 0 else 0.0,
        }
