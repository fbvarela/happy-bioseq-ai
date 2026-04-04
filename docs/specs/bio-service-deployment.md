# Bio-Service Deployment Options

The Python bio-service (`bio-service/`) runs FastAPI + Biopython for ORF finding,
motif detection, and sequence alignment. This doc covers every deployment path
with exact steps.

---

## TL;DR — Recommended choice per scenario

| Scenario | Recommendation |
|---|---|
| Fastest to ship, no infra | **Option C** — TypeScript engine (already built) |
| Best analysis quality | **Option B** — Railway |
| Already on Vercel, want one platform | **Option A** — Vercel Python (test first) |

---

## Option A — Vercel Python Runtime

> **Verdict:** Possible, but biopython's compiled C extensions risk build failures.
> Test before committing to this path.

### How it works
Vercel runs Python files in `api/` as serverless functions via its Python 3.13 runtime.
You wrap the FastAPI app with a single entry-point file.

### Steps

**1. Add the ASGI entry point**

Create `api/bio.py` at the repo root:

```python
# api/bio.py
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "bio-service"))

from main import app  # FastAPI app
```

**2. Add `vercel.json` to configure the Python runtime**

```json
{
  "functions": {
    "api/bio.py": {
      "runtime": "vercel-python@3.0.7",
      "maxDuration": 60
    }
  },
  "rewrites": [
    { "source": "/bio-api/(.*)", "destination": "/api/bio" }
  ]
}
```

**3. Add `requirements.txt` at the repo root** (Vercel reads it for the Python function)

```
fastapi==0.115.6
biopython==1.84
pydantic==2.10.3
```

> ⚠️ `biopython` pulls in `numpy` (~17MB compiled). Vercel's 250MB uncompressed
> function limit should fit, but build times will be 2–4 min on first deploy.

**4. Set env var**

```bash
vercel env add BIO_SERVICE_URL
# value: https://your-app.vercel.app/bio-api
```

**5. Deploy and verify**

```bash
vercel deploy
curl https://your-app.vercel.app/bio-api/health
# expected: {"status":"ok"}
```

**If the build fails** (numpy wheel not found for the target arch):
- Try pinning `numpy==1.26.4` in requirements.txt
- Or fall back to Option C (TypeScript engine) by leaving `BIO_SERVICE_URL` unset

---

## Option B — Railway (Recommended for best quality)

> **Verdict:** Easiest path for running the full Biopython stack. Free tier included.
> Takes ~10 minutes end-to-end.

### Steps

**1. Install Railway CLI**

```bash
npm i -g @railway/cli
railway login
```

**2. Create a new Railway project from the bio-service directory**

```bash
cd bio-service
railway init
# Select: "Empty project", give it a name like "bioseq-bio-service"
```

**3. Deploy**

```bash
railway up
# Railway detects Python via requirements.txt, installs deps, starts via Procfile
```

The `bio-service/Procfile` (already in the repo) tells Railway the start command:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**4. Get the public URL**

```bash
railway domain
# Prints something like: https://bioseq-bio-service.up.railway.app
```

**5. Set the env var in Vercel**

```bash
cd ..  # back to repo root
vercel env add BIO_SERVICE_URL production
# value: https://bioseq-bio-service.up.railway.app
vercel env add BIO_SERVICE_URL preview
# same value
```

Or via the Vercel dashboard: **Project → Settings → Environment Variables**.

**6. Verify**

```bash
curl https://bioseq-bio-service.up.railway.app/health
# {"status":"ok"}
```

**7. Redeploy the Next.js app so it picks up the new env var**

```bash
vercel deploy --prod
```

### Railway free tier limits
- 500 hours/month of compute (enough for a hobby project)
- Service sleeps after 30 min inactivity → first request after sleep has ~3s cold start
- Upgrade to Hobby ($5/mo) for always-on

---

## Option C — TypeScript Engine (No external service)

> **Verdict:** Zero infra. Works everywhere Vercel does. Slightly lower alignment
> quality for unequal-length variant sequences (no global alignment, positional diff only).
> **This is already built and active** — just don't set `BIO_SERVICE_URL`.

### How it works

`lib/bio.ts` implements the full analysis pipeline in TypeScript:
- Sequence type detection
- GC content
- ORF finding (all 6 reading frames, codon table translation)
- Motif detection (regex patterns)
- Simple sequence repeats
- Amino acid composition
- Variant positional diff

The API routes already fall back to it automatically when `BIO_SERVICE_URL` is unset.

### Steps

**1. Leave `BIO_SERVICE_URL` unset** (or remove it if already set)

```bash
# Don't add BIO_SERVICE_URL to Vercel env vars
# Or remove it:
vercel env rm BIO_SERVICE_URL production
```

**2. Deploy normally**

```bash
vercel deploy --prod
```

That's it. No Python, no separate service, no cold starts.

### Trade-offs vs Biopython

| Feature | TypeScript engine | Biopython |
|---|---|---|
| Sequence detection | ✅ identical | ✅ |
| GC content | ✅ identical | ✅ |
| ORF finding (6 frames) | ✅ | ✅ |
| Motif detection | ✅ | ✅ |
| Amino acid composition | ✅ | ✅ |
| Variant diff (equal length) | ✅ identical | ✅ |
| Variant alignment (unequal) | ⚠️ positional only | ✅ global alignment |
| Microsatellite finding | ✅ | ✅ |

---

## Option D — Fly.io

> Similar to Railway. Better free tier (3 shared VMs always free), more complex setup.

### Steps

**1. Install flyctl**

```bash
brew install flyctl
fly auth login
```

**2. Create a `Dockerfile` in `bio-service/`**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**3. Launch on Fly**

```bash
cd bio-service
fly launch --name bioseq-bio-service --region mad  # Madrid — close to eu-central-1 Neon
# Accept defaults, skip Postgres add-on
fly deploy
```

**4. Get the URL and set in Vercel**

```bash
fly status  # shows https://bioseq-bio-service.fly.dev
vercel env add BIO_SERVICE_URL production
# value: https://bioseq-bio-service.fly.dev
```

### Fly free tier limits
- 3 shared-cpu-1x VMs with 256MB RAM free
- No automatic sleep (unlike Railway free tier)
- Good fit if you want always-on without paying

---

## Switching between options

The Next.js app switches behavior purely via `BIO_SERVICE_URL`:

| `BIO_SERVICE_URL` value | Engine used |
|---|---|
| Not set | TypeScript engine (`lib/bio.ts`) |
| Set to Railway/Fly/Vercel URL | Python bio-service (with TS fallback on error) |

No code changes needed to switch — just update the env var and redeploy.
