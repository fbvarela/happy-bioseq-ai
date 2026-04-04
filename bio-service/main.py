"""BioSeq AI — Python Bio-Service (FastAPI + Biopython)"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from analyzers.sequence import analyze_sequence
from analyzers.variant import align_and_diff

app = FastAPI(title="BioSeq Bio-Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class SequenceRequest(BaseModel):
    sequence: str

    @field_validator("sequence")
    @classmethod
    def validate_sequence(cls, v: str) -> str:
        clean = v.strip().upper().replace(" ", "").replace("\n", "")
        if len(clean) < 10:
            raise ValueError("Sequence must be at least 10 characters")
        if len(clean) > 100_000:
            raise ValueError("Sequence too long (max 100,000 characters)")
        return clean


class VariantRequest(BaseModel):
    wild_type: str
    mutant: str

    @field_validator("wild_type", "mutant")
    @classmethod
    def validate_seq(cls, v: str) -> str:
        return v.strip().upper().replace(" ", "").replace("\n", "")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze(req: SequenceRequest):
    try:
        return analyze_sequence(req.sequence)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/variant")
def variant(req: VariantRequest):
    if not req.wild_type or not req.mutant:
        raise HTTPException(status_code=400, detail="Both sequences required")
    try:
        return align_and_diff(req.wild_type, req.mutant)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
