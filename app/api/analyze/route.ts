import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { annotateSequenceAI } from "@/lib/ai";
import { saveAnalysis } from "@/lib/db";
import { analyzeSequenceTS } from "@/lib/bio";
import type { BioAnalysis, SequenceAnalysisResult } from "@/lib/types";

const BIO_SERVICE_URL = process.env.BIO_SERVICE_URL;

export async function POST(req: NextRequest) {
  try {
    const { sequence, provider } = await req.json();

    if (!sequence || typeof sequence !== "string") {
      return NextResponse.json({ error: "sequence is required" }, { status: 400 });
    }

    const clean = sequence.trim().toUpperCase().replace(/\s+/g, "");
    if (clean.length < 10) {
      return NextResponse.json({ error: "Sequence too short (minimum 10 characters)" }, { status: 400 });
    }

    // Call Python bio-service for deterministic bioinformatics analysis
    let bioAnalysis: BioAnalysis;
    if (!BIO_SERVICE_URL) {
      // No external service configured — use built-in TypeScript engine
      bioAnalysis = analyzeSequenceTS(clean);
    } else {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        const bioRes = await fetch(`${BIO_SERVICE_URL}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequence: clean }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!bioRes.ok) throw new Error(`Bio-service error: ${bioRes.status}`);
        bioAnalysis = await bioRes.json();
      } catch (err) {
        console.warn("Bio-service unavailable, falling back to TS engine:", err);
        bioAnalysis = analyzeSequenceTS(clean);
      }
    }

    // AI annotation via Claude
    const aiAnnotation = await annotateSequenceAI(clean, bioAnalysis, provider);

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
