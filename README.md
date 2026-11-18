# Húsrýni — AI-assisted home condition reports (prototype)

Húsrýni ("house review") produces condition reports (*ástandsskýrslur*) for Icelandic property sales at a fraction of the cost of a traditional on-site inspection:

1. **Guided capture.** The seller, buyer or owner follows a checklist on their phone. The checklist depends on the property's type, build year, construction and heating.
2. **AI pre-screening.** Claude looks at the photos for each checklist item and gives a condition grade from TG0 to TG3 (or TGIU, "not assessed"). It asks for a retake when a photo is too poor and flags personal data. It also names the specialist check needed, such as a moisture reading, mould sample or sewer camera.
3. **Inspector sign-off.** For the *verified* tier, an inspector confirms, edits or rejects every AI finding and signs the report. AI suggests and the inspector decides: the app won't let anyone sign until every AI finding has been reviewed.

The pattern is the same one Nestic uses for move-out cleaning: guided photo capture, AI judgement, and a human with the final say. Here it is applied to pre-sale and pre-purchase home inspections. See [docs/business-plan.md](docs/business-plan.md) for the market and the business model.

> **Status: prototype.** Prices, repair-cost ranges and inspector login are placeholders. See [Before launch](#before-launch).

## Quick start

```bash
npm install
[ -f .env.local ] || cp .env.local.example .env.local   # first time only, never overwrites your key; then edit it
npm run addresses                                   # once: address suggestions (downloads the official register, 1–2 min)
npm run dev                                         # http://localhost:3000
```

- **Without an API key** the app runs in **demo mode**. A built-in analyser returns made-up findings, and every screen says so.
- **With Claude**, set `ANTHROPIC_API_KEY` in `.env.local`, or set `AI_MODE=claude` if you use an `ant auth login` profile.
- **Your Claude Max plan includes $100 a month of API credit**, roughly 50 full inspections. Claim it in claude.ai → Settings → Billing → **API credits**, link a Console organization, then create the key in the Console. Details are in [docs/ai-strategy.md](docs/ai-strategy.md).
- **Inspector console:** go to `/inspector`. The passcode is `INSPECTOR_PASSCODE`, which defaults to `demo` in development only.

Requires Node.js 22.12+.

## The flow

| Status | Who | What happens |
|---|---|---|
| `capturing` | Seller / buyer / owner | Uploads photos per item, runs the AI check, fixes retake requests, or marks an item "not accessible" |
| `in_review` | Inspector | *Verified tier:* reviews every AI finding (confirm / edit / reject), adds their own, and signs |
| `ai_report` | — | *Basic tier:* report published straight away and clearly labelled as an unverified AI draft |
| `verified` | — | Signed report with the inspector's name, licence number and statement; locked |

The inspection link (`/inspections/<random id>`) is the owner's access key, in the same way as Nestic's magic links. Photos are served by random id.

**Trust signals:**
- Live camera capture is the default, and photos picked from the device library are flagged on the inspector's review screen. Buyers distrusting seller-supplied information is what sank the UK's Home Information Packs (see the business plan).
- An optional price field lets the report show repair costs as a percentage of the price.

## Remedies & negotiation

This feature adapts the "who fixes it" step of Nestic's maintenance protocol to an Icelandic property sale. Once a report is ready, the buyer opens **Úrbætur og samningur** at `/inspections/<id>/negotiate`:

- **For each TG1–TG3 finding, the buyer chooses what happens:**
  - *seller repairs before handover*
  - *price reduction* (amount pre-filled from the cost range)
  - *common property* (owners' association; only for multi-unit, terraced and semi-detached homes)
  - *accept as is*
- **Totals:**
  - common-property items are scaled by the buyer's ownership share (*eignarhlutfall*);
  - everything is shown as a % of the price, next to the proposed 2% rule and the ~7–10% case-law threshold. This is reference information, not legal advice.
- **A share link `/s/<token>`** lets the seller or realtor:
  - **accept or dispute** each item, with reasons including *already disclosed in the sales summary*;
  - for repairs, upload **after photos**. Claude compares them with the inspection's before photos and returns fixed / partially / not fixed / can't tell. It refuses to judge photos of a different spot and flags cosmetic cover-ups.
- **A printable request document** for the realtor is at `/inspections/<id>/negotiate/document`.

## Address suggestions

The order form suggests addresses as you type, from **Staðfangaskrá**, Iceland's official address register (HMS, open data under CC BY 4.0, credited in the suggestion list).

- `npm run addresses` ([scripts/build-addresses.ts](scripts/build-addresses.ts)) downloads the register (38 MB CSV, refreshed daily by HMS) and builds `data/addresses.db`: about 134,000 addresses on 20,000 streets, without roads, substations, playgrounds and other non-buildings. Re-run it now and then; the running app picks up the new file by itself.
- `GET /api/addresses?q=…` searches that local copy ([src/lib/addressIndex.ts](src/lib/addressIndex.ts)), so what people type never leaves the server. Matching ignores case and accents and accepts `th`/`d`/`ae`/`o` for `þ`/`ð`/`æ`/`ö`.
- Typing a street name lists streets. Picking one fills the postcode and lists its house numbers, and picking an address fills both fields. Any address can still be typed in by hand, for example a new build that isn't in the register yet.
- Towns come from Pósturinn's postcode list ([src/lib/postcodes.ts](src/lib/postcodes.ts)), so addresses read as "Laugavegur 1, 101 Reykjavík" throughout the app.
- Without the index, the field is a plain text box and everything else works.

## How the AI part works

- **One request per checklist item** ([src/lib/ai/claude.ts](src/lib/ai/claude.ts)). Each request carries the photos, numbered, plus the property context, era-specific risk patterns ([src/lib/checklist.ts](src/lib/checklist.ts)) and the owner's notes.
- **Structured output.** Results come back as a fixed JSON format (`client.beta.messages.parse` with a Zod schema; see [src/lib/ai/schema.ts](src/lib/ai/schema.ts)), so the app never parses free text.
- **Two tiers.**
  - **Instant photo check:** right after each upload, `claude-haiku-5-5` (`AI_FAST_MODEL`) returns usable/retake plus an issue code, and the app shows fixed Icelandic/English advice. Cost is about $0.02 per inspection.
  - **Grading:** `claude-opus-5-5` (`AI_MODEL`) with `effort: "high"`, because defect spotting needs judgement.
  - [docs/ai-strategy.md](docs/ai-strategy.md) explains the choice, with prices and Icelandic benchmark scores for Claude, Gemini and OpenAI.
- **Refusal fallback** is on: `fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta. If the model declines a request for policy reasons, the API retries on its default fallback model. To turn it off, remove those two fields in `claude.ts`.
- **Prompt caching.** The system prompt contains no request-specific data, so it can be cached.
- **The AI never writes prices.** It chooses a `cost_key`, and the app looks up the ISK range in [src/lib/costs.ts](src/lib/costs.ts).
- **Images are resized in the browser** to 2000 px on the long edge ([src/lib/client/image.ts](src/lib/client/image.ts)). This cuts upload size and token cost, and re-encoding removes EXIF/GPS data.
- **Rough running cost:** about $2 per inspection. That is 40 photos at 3,888 image tokens each plus 20 grading calls, at Opus 5.5 prices. It's an estimate; measure it with real photos via the `usage` saved on each item.

## Project layout

```
src/
  app/                    Next.js App Router pages + API routes
    inspections/new       order form
    inspections/[id]      guided capture (owner)
    inspections/[id]/report   the report (print → PDF)
    inspector/            queue, review & sign
    api/                  JSON endpoints (create, upload, analyse, submit, inspector actions)
  components/             UI (Bootstrap 5)
  lib/
    checklist.ts          checklist items, era risk notes, age-based recommendations
    labels.ts             grade scale (TG0–TG3, TGIU) and other labels, IS/EN
    costs.ts              repair cost catalogue (placeholder figures!)
    report.ts             report aggregation, submit readiness
    repo.ts / db.ts       SQLite (better-sqlite3) data access + migrations
    storage.ts            local photo storage + file-type sniffing
    addressIndex.ts       address register: index builder + search (shared with the script)
    postcodes.ts          postcode → town, address formatting
    ai/                   prompt, schema, Claude client, demo analyser
scripts/build-addresses.ts  downloads the address register and builds data/addresses.db
tests/                    Vitest: checklist, AI mapping, addresses, full flow on a temp DB
docs/business-plan.md     research, competitors, pricing, go-to-market
```

## Scripts

```bash
npm test            # unit + flow tests (demo engine, temp database)
npm run addresses   # (re)build the address index from the official register
npm run typecheck
npm run build && npm start
```

## Before launch

These are deliberate prototype shortcuts:

- **Logins.** Inspectors share one passcode. Replace it with real accounts, for example Icelandic electronic ID via Auðkenni or island.is, and email magic links for owners.
- **Storage.** SQLite and local disk work for one server. For production, move to Postgres and EU-hosted object storage, with a data-retention policy.
- **Repair costs.** `src/lib/costs.ts` holds rough placeholder ranges. Replace them with contractor-sourced prices and set `COST_TABLE_VERIFIED = true`.
- **Legal.**
  - Terms and liability wording reviewed by an Icelandic lawyer.
  - A data processing agreement (DPA) and a GDPR data-protection impact assessment (DPIA) covering AI processing of photos.
  - Inspectors' professional liability insurance.
- **Payments**, **email notifications**, **rate limiting** and **CSRF tokens** on inspector actions.
- **Address register refresh.** Run `npm run addresses` on a schedule (weekly is plenty) so new builds show up.
- **Accuracy.** Build an evaluation set of real, inspector-graded photos before trusting the grades, and tune prompts against it.
