import { NextRequest, NextResponse } from "next/server";
import { analyzeVariantAI } from "@/lib/ai";

const BIO_SERVICE_URL = process.env.BIO_SERVICE_URL ?? "http://localhost:8001";

export async function POST(req: NextRequest) {
  try {
    const { wildType, mutant } = await req.json();

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

    // Get diff positions from bio-service
    let diffPositions: number[] = [];
    try {
      const bioRes = await fetch(`${BIO_SERVICE_URL}/variant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wild_type: wtClean, mutant: mutClean }),
        signal: AbortSignal.timeout(15_000),
      });
      if (bioRes.ok) {
        const data = await bioRes.json();
        diffPositions = data.diff_positions ?? [];
      }
    } catch {
      // bio-service optional for variant
    }

    // Detect sequence type
    const dnaRnaChars = /^[ATGCUN]+$/;
    const sequenceType = dnaRnaChars.test(wtClean) ? "nucleotide" : "protein";

    const variantResult = await analyzeVariantAI(wtClean, mutClean, sequenceType);

    return NextResponse.json({
      wildType: wtClean,
      mutant: mutClean,
      diffPositions,
      sequenceType,
      ...variantResult,
    });
  } catch (err) {
    console.error("Variant analysis error:", err);
    return NextResponse.json({ error: "Variant analysis failed" }, { status: 500 });
  }
}
