# Húsrýni — AI-assisted home condition reports (prototype)

Húsrýni ("house review") produces condition reports (*ástandsskýrslur*) for Icelandic property sales at a fraction of the cost of a traditional on-site inspection:

1. **Guided capture.** The seller, buyer or owner follows a checklist on their phone. The checklist depends on the property's type, build year, construction and heating.
2. **AI pre-screening.** Claude looks at the photos for each checklist item and gives a condition grade from TG0 to TG3 (or TGIU, "not assessed"). It asks for a retake when a photo is too poor and flags personal data. It also names the specialist check needed, such as a moisture reading, mould sample or sewer camera.
3. **Inspector sign-off.** For the *verified* tier, an inspector confirms, edits or rejects every AI finding and signs the report. AI suggests and the inspector decides: the app won't let anyone sign until every AI finding has been reviewed.
4. **After the report.** The buyer negotiates repairs and price, the owner keeps a property history with a yearly check, shares read-only access with an insurer or bank, drafts repair quotes, and can ask questions about the report.

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

### Test deployment on Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Ahmadhaq63/husryni)

[render.yaml](render.yaml) sets up one free web service in Frankfurt. Render asks for `ANTHROPIC_API_KEY` and `INSPECTOR_PASSCODE` and generates `SESSION_SECRET` itself.

- **Data is temporary.** The free plan has no permanent disk, so inspections and photos are wiped whenever the service restarts, redeploys or sleeps (after 15 minutes without visitors). The first visit after a pause takes 30–60 seconds.
- **For real use,** switch to `plan: starter` and add a disk at `/var/data` with `DATA_DIR=/var/data`; [render.yaml](render.yaml) has the details.
- **Anyone with the link can use the app** and spend API credit on your key, so share it only with your team.

## The flow

| Status | Who | What happens |
|---|---|---|
| `capturing` | Seller / buyer / owner | Uploads photos per item, runs the AI check, fixes retake requests, or marks an item "not accessible" |
| `in_review` | Inspector | *Verified tier:* reviews every AI finding (confirm / edit / reject), adds their own, and signs |
| `ai_report` | — | *Basic tier:* report published straight away and clearly labelled as an unverified AI draft |
| `verified` | — | Signed report with the inspector's name, licence number, statement and independence declaration; locked and sealed (see [The report standard](#the-report-standard)) |

The inspection link (`/inspections/<random id>`) is the owner's access key, in the same way as Nestic's magic links. Photos are served by random id.

**Trust signals:**
- Live camera capture is the default, and photos picked from the device library are flagged on the inspector's review screen. Buyers distrusting seller-supplied information is what sank the UK's Home Information Packs (see the business plan).
- An optional price field lets the report show repair costs as a percentage of the price.

## The report standard

Every report follows the same rules ([src/lib/standard.ts](src/lib/standard.ts)), and a signed report records which version of them it follows (`Húsrýni standard 1.0`):

- **Overall grade by a published rule**, never typed in: TG3 if any item needs immediate action or two or more items are TG3; TG2 if one item is TG3 or three or more are TG2; TG1 if there are other deviations; otherwise TG0. Each item counts once, by its worst finding. Items not assessed don't count but are listed. The report shows the rule and which items decided the grade, and a signed report keeps the grade it was signed with.
- **Cause and consequence on every TG2/TG3 finding.** Claude drafts both (a hidden cause is written as a possibility); the inspector can't sign until every TG2/TG3 finding has them.
- **"Not assessed" needs a reason.** Marking an item not accessible asks why (quick picks or free text); the report lists the reasons.
- **Moisture readings as data.** The inspector records readings from site (room, building part, WME %, meter type) on the review screen; the report shows them with a dry / at-risk / wet level. The limits (17 and 20 %) are provisional.
- **Ten building systems.** Every checklist item belongs to one of ten systems (roof, exterior walls, windows and doors, water supply, drains, heating and ventilation, electrical, wet rooms, interior, grounds/common property), shown as traffic lights, so reports compare across properties. Water-damage systems are marked.
- **Independence.** At signing the inspector confirms a declaration of interests (no stake in the sale, fixed fee whatever the result); the fee is printed on the report.
- **Seal.** At signing the server computes a SHA-256 fingerprint over the whole report, every photo's bytes included ([src/lib/seal.ts](src/lib/seal.ts)). The report prints the first 16 hex digits; anyone can check a copy at `/verify`, which recomputes the fingerprint from what is stored and says whether the report is unchanged. Photos added later for other purposes (the seller's repair photos) are outside the seal.
- **AI–inspector agreement.** The AI's original grade is kept when the inspector edits a finding. The inspector console shows, over signed reports, the share of items where the AI and the inspector gave the same or an adjacent grade (target 80 %), the same measure used for double inspections.

## Property history and the yearly check

Once a report is final, the owner can open **Ástandssaga** (`/inspections/<id>/history`):

- **Yearly owner check** (`/inspections/<check id>/annual`, about 10 minutes). First every open TG1–TG3 item from earlier reports: fixed / unchanged / worse, with a note and a new photo. Claude compares the report's photos with the new ones (fixed, partly fixed, unchanged, worse, can't tell) and flags answers the photos contradict. Then ten plain-language questions (damp, leaks, drains, radiators, windows, doors, electrics, smoke alarm, cracks, rain leaks); each "problem" answer becomes a new finding on the history.
- **What stays open** carries over to the next check: an item closes when the owner says fixed, unless the photos disagree.
- **Next check due** a year after the condition was last confirmed (the report, or the last completed check).
- **Same property.** Orders store the address register's id (HEINUM) when the address is picked from the list, next to the fastanúmer. Inspectors see earlier reports of the same property on the review screen. Owners only ever see their own reports.

## Owner tools

On a final report (owner's link only):

- **Read-only links** (`/r/<token>`) for an insurer, a bank or a buyer. The recipient sees the report, photos and seal, but not the owner's link, contact details or negotiation; the owner sees how often each link was opened and can revoke it.
- **Repair quote drafts** (`/inspections/<id>/quotes`): chosen findings become one draft per trade (plumber, electrician, carpenter …), with labour hours and materials estimated from the cost range and an hourly rate, plus VAT (24 %). The owner edits the lines, marks the quote sent and approves it, which locks it. Rates are placeholders ([src/lib/ownerTools.ts](src/lib/ownerTools.ts)).
- **Offer guide** for buyers who entered a price: asking price minus the price reductions they ask for, their share of common-property repairs and a 20 % risk buffer on TG3 repairs the seller won't fix, rounded down. An aid, not a valuation.
- **Report a problem** between checks: the owner describes it and gets which trade to call, how soon, and what to do right now (for example shut off the water). It is logged on the property history.
- **Ask** (bottom right on the report and history): questions about the property, answered by Claude from the report and its history only, in Icelandic or English, typed or spoken where the browser supports Icelandic speech. Capped at 40 questions per report per day. Demo mode answers by simple rules.

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
    inspections/[id]/history  property history; /annual the yearly owner check
    inspections/[id]/quotes   repair quote drafts
    r/[token]             read-only report through an owner's link
    verify/               check a signed report's fingerprint
    inspector/            queue, review & sign
    api/                  JSON endpoints (create, upload, analyse, submit, inspector actions)
  components/             UI (Bootstrap 5)
  lib/
    checklist.ts          checklist items, era risk notes, age-based recommendations
    labels.ts             grade scale (TG0–TG3, TGIU) and other labels, IS/EN
    costs.ts              repair cost catalogue (placeholder figures!)
    report.ts             report aggregation, submit readiness
    standard.ts           the report standard: overall-grade rule, systems, moisture scale, agreement
    seal.ts               SHA-256 seal of a signed report and its check
    annual.ts / annualRepo.ts   yearly owner check and property history
    ownerTools.ts / ownerRepo.ts read-only links, repair quotes, problem triage
    repo.ts / db.ts       SQLite (better-sqlite3) data access + migrations
    storage.ts            local photo storage + file-type sniffing
    addressIndex.ts       address register: index builder + search (shared with the script)
    postcodes.ts          postcode → town, address formatting
    ai/                   prompts, schemas, Claude client, demo analyser, assistant context
scripts/build-addresses.ts  downloads the address register and builds data/addresses.db
tests/                    Vitest: checklist, AI mapping, addresses, standard, seal, yearly check, owner tools, full flow on a temp DB
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
- **Repair costs.** `src/lib/costs.ts` holds rough placeholder ranges. Replace them with contractor-sourced prices and set `COST_TABLE_VERIFIED = true`. The same goes for the hourly rates in `src/lib/ownerTools.ts` and the offer guide's 20 % buffer.
- **Standard values to confirm with inspectors.** The moisture limits (17 / 20 % WME) and the overall-grade rule in `src/lib/standard.ts`. The seal is tamper evidence, not a qualified electronic signature.
- **Legal.**
  - Terms and liability wording reviewed by an Icelandic lawyer.
  - A data processing agreement (DPA) and a GDPR data-protection impact assessment (DPIA) covering AI processing of photos.
  - Inspectors' professional liability insurance.
- **Payments**, **email notifications**, **rate limiting** and **CSRF tokens** on inspector actions.
- **Address register refresh.** Run `npm run addresses` on a schedule (weekly is plenty) so new builds show up.
- **Accuracy.** Build an evaluation set of real, inspector-graded photos before trusting the grades, and tune prompts against it.
