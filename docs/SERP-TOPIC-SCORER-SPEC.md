# SERP Topic Scorer – Specification (Future Build)

> AI tool that fetches top 10 SERP results for a keyword, scores them for “weakness,” and returns a **Topic Score** to signal whether S.E.E should write the article. Use this doc as the spec when building.

---

## 1. Goal

- **Input**: Keyword (+ optional country/locale).
- **Output**: A **Topic Score** (e.g. 1–10 or Easy/Medium/Hard) plus:
  - Weakness analysis of top 10 results.
  - Recommended angle/outline to beat the SERP.
  - “Write / Don’t write” style signal for S.E.E.

---

## 2. Scoring Criteria (“Weak” Checklist)

Score each result (e.g. 1–5) on:

| Criterion | What to check |
|-----------|----------------|
| **Content depth** | Thin vs comprehensive (word count, section depth, examples). |
| **SERP match** | Does the page satisfy search intent? (informational vs commercial vs local.) |
| **Content quality** | Originality, structure, usefulness, citations. |
| **Trust signals** | Author, about page, freshness, brand recognition. |
| **UX / spaminess** | Ads, popups, aggressive affiliate, intrusive interstitials. |

**Weak signals (free to detect):**

- **Thin content**: &lt;800–1200 words for an intent that needs depth; shallow headings; no examples/data; repetitive fluff.
- **Poor SERP match**: Page intent doesn’t match query (e.g. product page for “how to”).
- **Low authority hints**: Unknown brand, no author/about, few external references, spammy template look.
- **Outdated**: Old dates, stale advice, broken links, no updates.
- **Weak UX**: Intrusive ads, popup gates, hard-to-read, aggressive affiliate, slow feel.

*Note: True DA/DR/backlinks require paid data; this spec relies on content + intent + UX signals.*

---

## 3. AI Prompt (Scoring + Summary)

Use this (or a variant) when sending SERP data to the LLM:

```text
You are doing SERP gap and competition analysis.

Keyword: "<KEYWORD>"
Search intent guess: (informational / commercial / local / etc.)

Here are the top 10 results with URL + snippet + headings + notes:
1) ...
2) ...
...

Score each result 1–5 for:
- Content depth (thin vs comprehensive)
- SERP match (does it satisfy intent?)
- Content quality (originality, structure, usefulness)
- Trust signals (author, citations, freshness, brand)
- UX spaminess (ads, popups, aggressive affiliate, intrusive interstitials)

Then answer:
- Which results are weakest and why (specific)
- What content type Google seems to reward (listicle, guide, tool, category page, etc.)
- Missing subtopics/questions across the SERP (gap list)
- A recommended outline to beat them + unique angle
- A "win likelihood" verdict (easy / medium / hard) with reasoning
- Topic Score: 1–10 where 10 = strong "write this" signal (weak SERP, clear angle)
```

---

## 4. Architecture (MVP → V2 → V3)

### MVP (most reliable)

- **User provides**: keyword + (optional) country + **list of top 10 URLs** (copy-paste from SERP).
- **Tool**:
  1. Fetches each URL.
  2. Extracts: title, meta description, headings (H1/H2/H3), main text (cleaned, truncated).
  3. Builds a single prompt with the checklist + data.
  4. Calls LLM → returns Topic Score + weakness summary + recommended angle/outline.

### V2

- Add **automated SERP lookup** via a SERP API (e.g. DataForSEO, SerpApi, etc.) so user only provides keyword + country.
- Keep same fetch + extract + LLM scoring pipeline.

### V3

- Caching + dedup of fetched pages.
- Detect content type (guide, listicle, product, etc.).
- Generate “how to beat this SERP” brief (outline + primary/LSI hints) for S.E.E article generation.

---

## 5. Token Cost (Approximate)

| Mode | Input (10 results) | Output | Total per keyword |
|------|--------------------|--------|--------------------|
| **Low (recommended)** | Headings + snippet + short excerpt only (~300–1k tokens/page) | ~800–2k | **~4k–12k tokens** |
| **Medium** | Cleaned main content, truncated (~2k–6k/page) | ~1k–3k | **~21k–63k tokens** |
| **Heavy** | Full content per page | 8k–20k+ per page | **80k–200k+ tokens** (usually not worth it) |

**Cost-saving:**

- Do **not** send full page HTML/text. Use: title, meta, headings, first ~1–2k words of main content.
- Optional **two-pass**: (1) cheap per-page weakness score from headings/excerpt; (2) deep analysis only for 3–4 most relevant/strong competitors.

---

## 6. Integration with S.E.E

- **Output**: Topic Score (e.g. 1–10 or Easy/Medium/Hard) + “Write / Don’t write” signal.
- **Optional**: Pass “recommended outline” + “primary/LSI keywords” into S.E.E article generation (config/prompt layer).
- **Where it could live**: New admin page “Topic Scorer” or a step before “Generate with AI” in the article editor.

---

## 7. Dependencies / Notes

- **SERP source**: Manual URL list (MVP) or paid SERP API (V2).
- **Fetching**: Need robust HTML fetch + readability/boilerplate removal (e.g. readability-style extractor).
- **LLM**: Same OpenRouter (or other) provider as S.E.E; reuse existing API key/config where possible.
- **No paid authority metrics** in this spec; “low competition” is approximated via content weakness + intent mismatch + UX signals.

---

*Document version: 1.0 – for future implementation.*
