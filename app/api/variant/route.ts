import { NextRequest, NextResponse } from "next/server";
import { analyzeVariantAI } from "@/lib/ai";
import { variantDiffTS } from "@/lib/bio";

const BIO_SERVICE_URL = process.env.BIO_SERVICE_URL;

export async function POST(req: NextRequest) {
  try {
    const { wildType, mutant, provider } = await req.json();

    if (!wildType || !mutant) {
      return NextResponse.json(
        { error: "wildType and mutant sequences required" },
        { status: 400 }
      );
    }

    const wtClean = wildType.trim().toUpperCase().replace(/\s+/g, "");
    const mutClean = mutant.trim().toUpperCase().replace(/\s+/g, "");

    if (wtClean.length < 10 || mutClean.length < 10) {
      return NextResponse.json({ error: "Sequences too short" }, { status: 400 });
    }

    // Get diff positions — try bio-service first, fall back to TS engine
    let diffData = variantDiffTS(wtClean, mutClean);

    if (BIO_SERVICE_URL) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        const bioRes = await fetch(`${BIO_SERVICE_URL}/variant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wild_type: wtClean, mutant: mutClean }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (bioRes.ok) diffData = await bioRes.json();
      } catch {
        // bio-service unavailable — diffData already set by TS engine
      }
    }

    const dnaRnaChars = /^[ATGCUN]+$/;
    const sequenceType = dnaRnaChars.test(wtClean) ? "nucleotide" : "protein";

    const variantResult = await analyzeVariantAI(wtClean, mutClean, sequenceType, provider);

    return NextResponse.json({
      wildType: wtClean,
      mutant: mutClean,
      diffPositions: diffData.diff_positions ?? [],
      sequenceType,
      ...variantResult,
    });
  } catch (err) {
    console.error("Variant analysis error:", err);
    return NextResponse.json({ error: "Variant analysis failed" }, { status: 500 });
  }
}
