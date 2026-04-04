"""Variant comparison utilities."""

from Bio.Align import PairwiseAligner


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

        aligned_wt, aligned_mt = str(aln).split("\n")[0], str(aln).split("\n")[2]

        diff_positions = []
        real_pos = 0
        for a, b in zip(aligned_wt, aligned_mt):
            if a != b:
                diff_positions.append(real_pos)
            if a != "-":
                real_pos += 1

        max_score = 2.0 * max(len(wt), len(mt))
        norm_score = aln.score / max_score if max_score > 0 else 0.0

        num_insertions = aligned_wt.count("-")
        num_deletions = aligned_mt.count("-")
        num_substitutions = sum(
            1 for a, b in zip(aligned_wt, aligned_mt)
            if a != "-" and b != "-" and a != b
        )

        return {
            "diff_positions": diff_positions[:100],
            "num_substitutions": num_substitutions,
            "num_insertions": num_insertions,
            "num_deletions": num_deletions,
            "alignment_score": float(max(0, min(1, norm_score))),
        }
    except Exception:
        min_len = min(len(wt), len(mt))
        diff_positions = [i for i in range(min_len) if wt[i] != mt[i]]
        return {
            "diff_positions": diff_positions,
            "alignment_score": 1.0 - len(diff_positions) / min_len if min_len > 0 else 0.0,
        }
