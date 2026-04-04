import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { annotateSequenceAI } from "@/lib/ai";
import { saveAnalysis } from "@/lib/db";
import type { BioAnalysis, SequenceAnalysisResult } from "@/lib/types";

const BIO_SERVICE_URL = process.env.BIO_SERVICE_URL ?? "http://localhost:8001";

export async function POST(req: NextRequest) {
  try {
    const { sequence } = await req.json();

    if (!sequence || typeof sequence !== "string") {
      return NextResponse.json({ error: "sequence is required" }, { status: 400 });
    }

    const clean = sequence.trim().toUpperCase().replace(/\s+/g, "");
    if (clean.length < 10) {
      return NextResponse.json({ error: "Sequence too short (minimum 10 characters)" }, { status: 400 });
    }

    // Call Python bio-service for deterministic bioinformatics analysis
    let bioAnalysis: BioAnalysis;
    try {
      const bioRes = await fetch(`${BIO_SERVICE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence: clean }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!bioRes.ok) throw new Error(`Bio-service error: ${bioRes.status}`);
      bioAnalysis = await bioRes.json();
    } catch (err) {
      // Fallback: basic analysis without bio-service
      console.warn("Bio-service unavailable, using fallback:", err);
      bioAnalysis = fallbackAnalysis(clean);
    }

    // AI annotation via Claude
    const aiAnnotation = await annotateSequenceAI(clean, bioAnalysis);

    const result: SequenceAnalysisResult = {
      id: randomUUID(),
      rawSequence: clean,
      bioAnalysis,
      aiAnnotation,
      createdAt: new Date().toISOString(),
    };

    // Persist to DB (non-blocking — don't fail if DB is down)
    saveAnalysis(result).catch((e) => console.error("DB save failed:", e));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

function fallbackAnalysis(sequence: string): BioAnalysis {
  const dnaChars = new Set(["A", "T", "G", "C", "N"]);
  const rnaChars = new Set(["A", "U", "G", "C", "N"]);
  const proteinChars = new Set([
    "A","C","D","E","F","G","H","I","K","L","M","N","P","Q","R","S","T","V","W","Y","*",
  ]);

  const chars = new Set(sequence.split(""));
  let seqType: BioAnalysis["sequenceType"] = "unknown";

  if ([...chars].every((c) => dnaChars.has(c))) seqType = "DNA";
  else if ([...chars].every((c) => rnaChars.has(c))) seqType = "RNA";
  else if ([...chars].every((c) => proteinChars.has(c))) seqType = "protein";

  const gcCount = sequence.split("").filter((c) => c === "G" || c === "C").length;

  return {
    sequenceType: seqType,
    length: sequence.length,
    gcContent: seqType === "DNA" || seqType === "RNA"
      ? (gcCount / sequence.length) * 100
      : undefined,
  };
}
