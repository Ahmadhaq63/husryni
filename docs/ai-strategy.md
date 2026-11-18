# AI strategy: best quality at the lowest cost (17 Nov 2026)

## Decision

Stay on Claude, in two tiers. The first year of AI usage is covered by the API credit that comes with the existing Claude Max plan.

| Tier | Job | Model | Cost per inspection* |
|---|---|---|---|
| 1. Instant photo check | Right after each upload: is the photo usable (dark, blurry, wrong subject, people)? Returns **a code only**; the app shows fixed Icelandic/English advice | Claude Haiku 5.5 (`AI_FAST_MODEL`) | ≈ $0.02 |
| 2. Grading and findings | Per checklist item: TG0–TG3 grades, findings in Icelandic, follow-ups, before/after repair check | Claude Opus 5.5 (`AI_MODEL`) | ≈ $2 |

\* 40 photos at 2000×1500 (3,888 image tokens each on Claude), 20 grading calls of about 3k output tokens. Source: research run, 17 Nov 2026 (A1, A2).

**Why Opus 5.5 for grading:**
- **Icelandic.** It scores **0.709** on Miðeind's Icelandic LLM leaderboard, 3rd of 102 models; Sonnet 5.5 scores 0.621 and Haiku 5.5 0.499 (I1).
- **Defects.** On the building-facade benchmark DefectBench, Claude was the only model family to count defects reliably (Q1).
- **Cost.** About $2 per inspection is around 0.5% of a 49,900 kr. report. The inspector's time is the real cost.

**Why Haiku 5.5 only returns a code:**
- Its Icelandic is weak (0.499).
- Fixed advice per code is consistent, reviewed text.
- It cuts output tokens.

## Who pays for the API (verified on the vendors' pages)

| Subscription | API credit included | How to claim |
|---|---|---|
| **Claude Max ($100/mo)** | **$100 / month** of Claude API credit. Expires each billing cycle. Claude Platform API only, not Claude Code, Bedrock or Google Cloud. | After 7 days on the plan: claude.ai → Settings → Billing → **API credits**. Select or create the Console organization and link it. The credits then appear in the Console under Billing → Promotional credits; create an API key there. |
| **ChatGPT Pro** | $100, $200 or $500 / month depending on the Pro tier. Plus, Go and Free: none. | ChatGPT Settings → Billing → API credits; choose the API organization (same email). |
| Google AI Pro | $10 / month of Gemini API / Agent Platform credit (per Google's developer-benefits page; not re-checked) | Google Developer Program profile → benefits |

At about $2 per inspection, **the Max credit covers about 50 full inspections a month.**
- When the credit runs out, API calls stop until the next monthly grant unless you buy credits. Add a small prepaid balance before real customers arrive.
- The app has no other billing link to your subscription.

## Alternatives, for when volume grows

Prices are from the vendors' pages; Icelandic scores are from Miðeind's leaderboard.

| Model | Cost / inspection | Icelandic (avg / writing quality) | Notes |
|---|---|---|---|
| Claude Opus 5.5 | $1.98 | 0.709 / 0.745 | current choice |
| Claude Sonnet 5.5 | $0.99 | 0.621 / – | half price, weaker Icelandic |
| Gemini 4 Hydrogen | $0.58 | 0.671 / 0.794 | paid tier required (see below) |
| GPT-6.1 Terra | $0.46 | 0.646 / 0.773–0.843 | best Icelandic writing scores; "visual reasoning" model |
| Gemini 3.8 Flash | $0.29 | – | price doubles on 1 Jan 2027 |

**How to switch, if at all:**
- Only after a blind comparison on **100–300 Icelandic photos graded by an inspector**.
- Measure agreement on the 0–3 grades with weighted kappa, and have a native speaker rate the written findings.
- Your ChatGPT Pro credit can pay for testing GPT-6.1 Terra.

**Rules that apply whichever model is used:**
- **No Gemini free tier for customers.** Google's terms say only *paid* services may be offered to users in the EEA, which includes Iceland, and free-tier content may be used to improve Google's products.
- **Data protection:**
  - The Anthropic API doesn't train on your data by default, and deletes inputs and outputs within 30 days.
  - If customers or partners require EU-only processing, Claude 5.5 models are available in the EU via Google Cloud's Agent Platform or Bedrock EU inference profiles. The subscription credit does not apply on those platforms.

## Cost levers, in order

1. **Spend the included credits first** (Claude Max, then ChatGPT Pro for experiments).
2. **Batch API (−50%)** for anything that can wait: summaries and re-analysis.
3. **Lower `AI_EFFORT`** on easy items, and keep findings short. Output tokens are 61–85% of the bill.
   - Measured on 17 Nov 2026 (one real window photo, Opus 5.5, same prompt):

     | Effort | Time | Output tokens | Cost per item |
     |---|---|---|---|
     | low | 6 s | 521 | $0.03 |
     | medium | 9 s | 802 | $0.03 |
     | **high** (default) | 14 s | 1,315 | $0.04 |
     | max | 114 s | 11,460 | $0.25 |

   - All four reached the same conclusion. `high` added one "not visible" note. **Never use `max` for grading:** it is 8× slower, 6× dearer, and close to the 16,000-token cap, where answers get cut off.
   - With two photos, a `high` analysis took 26 s end to end.
4. **Smaller images.** At 1568 px instead of 2000 px, an image costs 2,352 tokens instead of 3,888, about 12% less in total. Only do this after an evaluation shows fine cracks are still seen.
5. **A free on-device blur/darkness check** before upload (Laplacian variance, as in DefectBench). Needs calibration on real photos first.

## Evaluation plan, needed before trusting grades

- **Main set:** collect 100–300 real Icelandic photos with inspector grades. This matters most.
- **Supplementary open sets** (the licences allow commercial use):
  - CUBIT-Det: cracks, spalling, moisture (CC BY 4.0)
  - MBDD2025: facade cracks, leakage, corrosion (CC BY 4.0)
  - BD3: algae, cracks, peeling, stains (MIT)
  - SDNET2018 / CCIC: cracks (CC BY 4.0)
- **Avoid** CODEBRIM and dacl10k: non-commercial licences.
- **Gaps:**
  - There is no public benchmark for interior mould or water damage, so our own data is the only real test.
  - The best published zero-shot sewer-defect score is about 0.5 F1 (Q2). That supports our rule: recommend a sewer camera; don't judge pipes from photos.

## Sources

- **Anthropic:** A1 platform.claude.com/docs/en/about-claude/pricing · A2 …/build-with-claude/vision · A7 …/about-claude/api-credits-for-subscribers
- **OpenAI:** developers.openai.com/api/docs/guides/chatgpt-api-credits · …/pricing
- **Google:** aistudio.google.com/docs/pricing · …/docs/terms
- **Icelandic:** I1 huggingface.co/spaces/mideind/icelandic-llm-leaderboard
- **Benchmarks:** Q1 arxiv.org/abs/2603.20148 (DefectBench) · Q2 Cambridge Prisms: Water, multiclass sewer defect detection with VLMs
