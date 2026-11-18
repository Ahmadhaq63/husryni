# Húsrýni: business plan (draft, 17 Nov 2026)

**One line:** Nestic's model of guided capture, AI judgement and a human decision, applied to the condition of homes being sold in Iceland. A seller or buyer photographs the home by following a checklist. AI grades each building component, a certified inspector reviews and signs remotely, and a site visit or specialist check is booked only where the photos show it is needed.

Figures come from the sources at the end; [n] refers to that list. Anything marked *(assumption)* is our estimate and has not been checked.

---

## 1. Why this, why now

- **Inspections are expensive, so few buyers get one.** An on-site inspection with a written report costs about **97,000–220,000 kr.** depending on size [I1–I9]. Specialist checks cost extra: sewer camera 67,000–86,000, moisture visit 72,000–96,000, electrical 94,000–112,000 [I2][I4][I6][I7][I9]. No statistics exist on how often homes are inspected, and the consumers' association calls it "strikingly rare" [I26].
- **The law puts the burden on the buyer.**
  - The buyer has a duty to inspect (Act 40/2002 art. 29), and the seller has a duty to disclose (art. 26).
  - A used home only counts as defective if the problem lowers its value "svo nokkru varði" (to a meaningful degree). Case law puts that at roughly **7–10 % of the price** [I25–I28].
  - Disputes are slow. Court cases take about 13.6 months at district level plus about 12.6 months on appeal [I28].
- **Policy is heading the same way, but it isn't law yet.**
  - Althingi resolution 23/151 (2021) asked for standard condition reports with every listing, plus a digital maintenance logbook for each property.
  - The ministry working group (Oct 2024) rejected *mandatory* reports. Instead it proposed:
    - a standard seller questionnaire;
    - a buyer's right to request an inspection **within 48 hours** of an accepted offer, with scope that grows with the building's age;
    - a **2 % rule**: repairs under 2 % of the price leave the sale standing; above that, the parties renegotiate.
  - No bill has been introduced as of Nov 2026 [I25][I32][I33].
  - **What we do with this:** the product is built so it fits that framework if the bill passes and is still useful if it doesn't.
- **The market is softer.** 51 % of new capital-area homes sold below asking price in Oct 2026 [I53]. Buyers therefore have more leverage to make offers subject to inspection ("með fyrirvara um ástandsskoðun"), which is how inspections are usually ordered today [I1][I7][I23].
- **Common defects are the kind photos can triage.**
  - Windows and exterior doors caused damage in **61 %** of 150 moisture-damage cases, followed by bathroom waterproofing and roofs; 4 of 10 flat roofs had caused damage [I22].
  - Concrete with alkali–silica reaction is concentrated in buildings from about 1960–75 [I42].
  - Defects are also common in new builds: about 40 % of owners' associations in buildings from 2014–2022 had paid for defect repairs [I45]. HMS estimates defects cost at least 25 billion kr. a year [I35].

## 2. What we take from Nestic

| Nestic (move-out cleaning) | Húsrýni (property sale) |
|---|---|
| The landlord (B2B) pays and requires tenants to use it | Sold through **realtors** and to **buyers/sellers**; the seller or buyer takes the photos |
| Step-by-step photo checklist | Checklist adapted to type, build year, construction and heating |
| AI checks each photo and asks for retakes | AI grades each component **TG0–TG3 / TGIU** (Norwegian NS 3600 scale) and asks for retakes |
| "AI recommends, landlord decides" (GDPR Art. 22) | The **inspector must confirm, edit or reject every AI finding** before signing; this is enforced in code |
| Fallback: on-site inspection and a cleaning charge | Fallback: a **targeted** site visit, moisture reading, sewer camera or electrician check |
| Integrations with property-management systems | Later: realtor listing systems, HMS registers, bank/insurer APIs |

## 3. How other countries do it

| Country | Who pays | Price | What we learn |
|---|---|---|---|
| **Denmark** — tilstandsrapport + el-report | Seller | DKK 5–8k (DKK 8–15k bundled) | Seller is released from 10-year liability if the buyer is offered insurance (seller pays half). 89,541 reports and 159 complaints in 2025 (~0.18 %) [A1][A2][A8] |
| **Norway** — tilstandsrapport (2022 reform) | Seller | NOK 10–25k | NS 3600 grades TG0–TG3/TGIU. Buyer is "deemed to know" what the report clearly says. Wet rooms need a moisture check. TG3 items need a cost estimate. 80–90 % of sellers buy seller insurance [A10–A15] |
| **Sweden** — överlåtelsebesiktning | Buyer (seller-ordered version is also possible) | SEK 8–10k | A buyer can "buy into" the seller's inspection at about half price and then holds the inspector **directly liable** [A24] |
| **Finland** — kuntotarkastus | Seller, usually | Often > €1,000 | Voluntary, sensory inspection; does not release the seller [A21][A22] |
| **UK** — RICS surveys, Material Information | Buyer (survey) / seller (pack) | £300–1,500; Moverly £150–250 | The seller packs (HIPs) failed because buyers didn't trust information the seller provided [A34][A35]. RICS AI standard (Mar 2026): disclose AI use, surveyor stays accountable [A61] |
| **US** — Spectora, ISN, Repair Pricer | Inspector (SaaS) | $4–7 per inspection or $89–109/mo | AI drafts, inspector approves. Repair-cost add-ons resell at $70–100 [A36–A45] |
| **AI / remote** — Flyreel, Hover, Hosta, Tractable | Insurer / contractor | Per job / subscription | Capture **on the device** with live prompts and quality feedback. AI sorts cases into fast-track vs manual review [A48–A56] |

**What this means for us:**
- Customers pay for the legal effect of a report, not the PDF.
- Hybrid works: remote AI plus a qualified human signature.
- The report must be trusted by **the buyer**, not just the seller.

## 4. Product

**Tiers (draft prices, VAT included; see `src/lib/pricing.ts`):**

| Tier | Price | What you get |
|---|---|---|
| Basic (AI) | 19,900 kr. | Guided capture, AI grades, recommended specialist checks, repair-cost ranges. Clearly labelled *not verified*. |
| Verified | 49,900 kr. | Basic plus a certified inspector who reviews every finding and signs, **within 48 hours** of receiving photos. Specialist checks booked only where needed. |
| Realtors | Quote | A verified report with each listing; the seller does the capture; volume pricing. |

**Why these prices:**
- Verified sits below every full on-site report (97,000+) and at the low end of report-less walk-throughs (40,000–100,000) [I1–I12].
- The research brief suggested 50,000–80,000, and comparable products abroad charge about €350–600 *(conversion)*. Testing 59,900 is reasonable.

**Built for trust:**
- Live camera capture is the default. Photos picked from the library are flagged to the inspector.
- Photos are re-encoded in the browser, which strips GPS/EXIF data.
- The inspector is independent of the seller.
- Each finding is labelled as coming from the AI or from the inspector.
- Every AI analysis is stored with the model name.

**Built for the 2024 working-group framework:**
- The checklist grows with building age.
- Repair costs can be shown as **a percentage of the price** (2 % rule / 7–10 % case-law threshold).
- The report is ready within 48 hours.

**Official status checks (what photos can't show):**
- **Construction stage under ÍST 51:2021.** B1 permit, B2 weathertight, B3 ready for fit-out, B4 completed.
  - A lived-in home still at B3 suggests the final inspection (*lokaúttekt*) never happened, although regulation 112/2012 art. 3.9.1 requires it within 3 years of the building being taken into use.
  - B4 alone does not prove a final-inspection certificate exists, so the report tells buyers to request the certificates and the building's handbook (*handbók hússins*).
  - Lenders care: Brú lends on new builds only from B3 plus assessment stage 8, and Birta does not lend on unapproved property.
- **Approved drawings.**
  - The report links the municipality's drawing portal: Reykjavík, Kópavogur, Hafnarfjörður, Garðabær, Mosfellsbær, Akureyri.
  - Unapproved changes are classic undisclosed-defect claims under arts. 26–27 of Act 40/2002: enclosed balconies need a permit, as do converted spaces.
- **Risk notes by building year.**
  - Asbestos (about 1950–1983; imports banned 1983).
  - Tap hot water above 65 °C (art. 14.5.10).
  - Residual-current devices (RCDs), required at 30 mA; HMS found about 10% of older units faulty.
  - Smoke alarms (one per floor and per 80 m²).

**What photos cannot do:**
- see inside walls, under floors or inside pipes;
- measure moisture.

The report says this plainly, and the product turns it into referrals: sewer camera, moisture reading, mould sample, electrician.

### Inspector toolkit for targeted site visits

Snapshot web prices from Nov 2026, some from search snippets; check before buying.

| Tool | Price (approx.) | Reveals what photos can't |
|---|---|---|
| Phone thermal camera (InfiRay P2 Pro / FLIR ONE Gen 3 / FLIR Edge Pro) | €195 / £144 / €400–490 | Wet or missing insulation, cold bridges, air leaks, floor-heating and pipe leaks, overheating breakers. Needs a ~10 °C indoor–outdoor difference. |
| Pinless moisture meter (Trotec BM31) | ≈ €118 | Non-destructive damp mapping behind tiles, around showers and windows (~4 cm deep) |
| Pin moisture meter (Brennenstuhl MD) | ≈ €22–41 | Exact moisture % in wood or plaster |
| Borescope (Bosch UniversalInspect / GIC 12V) | ≈ €99 / €222 | Wall and floor cavities, crawl spaces, first metres of a sewer clean-out |
| Laser distance meter (Bosch GLM 40) | ≈ €97 | Actual room sizes vs registered m² and drawings |

A full kit costs about **€550–900 per inspector**. It turns a targeted site visit into a measured one, which is where the verified tier earns trust.

## 5. Unit economics *(assumption)*

| Per verified report | kr. |
|---|---|
| Price incl. VAT | 49,900 |
| Net of VAT (24 %) | ≈ 40,240 |
| Inspector review, 30–45 min at ≈ 28,000/h [I2] | ≈ 14,000–21,000 |
| AI (≈ 40 photos + 20 item calls, Claude Opus 5.5) | ≈ 150–450 |
| Payment fees, hosting, storage | ≈ 1,500 |
| **Contribution** | **≈ 17,000–24,000 (≈ 45–60 % of net)** |

- **Extra revenue:** referral fees on specialist checks. One inspection often triggers one or two of them, at 67,000–112,000 each.
- **Market ceiling:**
  - About 11,500–13,200 home sales a year [I48][I49].
  - If every sale bought a ~130,000 kr. inspection, the market would be about 1.5 billion kr. [I-inferred].
  - At 15 % of sales on our verified tier, revenue would be about 70–80 million kr. a year before add-ons *(assumption)*.
  - **Conclusion:** Iceland alone is a small market, so plan adjacent markets from the start (§6).

## 6. Go to market

1. **Buyers (now).** Use the soft market and the "subject to inspection" offer. Message: "A report in 48 hours, at about a third of the price."
2. **Realtors (main channel).**
   - Realtors must describe a property's condition in the sales summary (söluyfirlit) and are liable for negligence (Act 70/2015 arts. 11–12) [I25].
   - One agency (Nýhöfn) already paid for inspections of all its listings in 2020 [I24].
   - Sell volume packs, plus an API into listing systems.
3. **Sellers** who want a clean report before listing.
4. **Rentals (adjacent market).** Condition reports at move-in and move-out are closest to Nestic. Frumherji's rental inspections start at 49,800 [I2].
5. **Later:**
   - banks and insurers (condition data);
   - a **digital maintenance logbook** per property number (as in resolution 23/151, and like Norway's Boligmappa) [A16].

## 7. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Liability for a missed defect | Fixed scope and clear limitations. Liability fault-based and capped at the fee, as Frumherji does today [I1]. Inspector professional-liability insurance. AI never signs. |
| AI accuracy | An evaluation set of real, inspector-graded photos before launch. Low-confidence or poor photos → TGIU plus a follow-up check. The inspector reviews every finding. |
| Buyers distrust seller-captured photos (the UK HIP problem) | Live camera capture, library photos flagged, independent inspector. Possibly a Swedish-style "buyer buy-in" giving the buyer direct inspector liability. |
| Regulation (licensing proposals) | Use inspectors with construction-manager qualification and insurance from day one, which matches the working group's proposal [I25]. |
| Data protection (GDPR) | Data processing agreement (DPA) and data-protection impact assessment (DPIA). EU storage. Minimal personal data. No people in photos (AI flags them). Disclose the AI provider and where processing happens. |
| Incumbents copy us | Speed (48 h), better triage, the realtor channel, and the logbook data asset. |
| Small market | Rentals, owners and the logbook; then other Nordic markets without strict reporting rules (e.g. Finland). |

## 8. Next 90 days

1. **Data and accuracy.** Collect 300–500 real photos with inspector grades from 2–3 partner inspectors. Build the evaluation set and tune the prompts.
2. **Real cost table.** Get repair-cost ranges from contractors to replace the placeholders in `src/lib/costs.ts`.
3. **Legal.** Get terms, liability caps and the data agreements reviewed by an Icelandic lawyer. Arrange inspector insurance.
4. **Pilot.** Run 20–30 inspections with 1–2 realtors. Measure time to report, how many specialist checks get triggered, and inspector review time.
5. **Production basics.**
   - Login with Icelandic electronic ID (Auðkenni / island.is).
   - Payments.
   - Email notifications.
   - Postgres and EU object storage.
   - Pre-fill property details from the HMS registers (bulk access has setup and monthly fees [I39]).

---

## Sources

**Iceland**

- [I1] https://frumherji.is/fasteignaskodun/
- [I2] https://frumherji.is/wp-content/uploads/2026/01/FRH-3690-01.2026.pdf
- [I3] https://serskodun.is/thjonusta/astandsskodun/
- [I4] https://serskodun.is/verdskra/
- [I5] https://www.mbl.is/smartland/heimili/2026/11/16/vid_skodum_sjaanlegar_skemmdir_og_leitum_ad_ummerkj/
- [I6] https://fagmat.is/verdskra
- [I7] https://www.afagmenn.is/
- [I8] https://beton.is/
- [I9] https://www.verndogvidhald.is/astandsskodun
- [I10] https://steind.is/mat-vegna-fasteignakaupa-og-leigu/
- [I11] https://www.heilhus.is/
- [I12] https://www.fasteignaskodun.is/
- [I22] https://skemman.is/bitstream/1946/34865/1/Arnar%20%C3%9E%C3%B3r%20Hr%C3%B3lfsson.pdf
- [I23] https://urlausnir.is/ (insurance complaints board ruling 2024-166)
- [I24] https://www.visir.is/g/20202024586d/ekki-haegt-ad-aetlast-til-ad-kaupendur-hafi-thekkingu-til-ad-meta-astand-eigna
- [I25] https://samradapi.island.is/api/Documents/43b6a80a-6390-ef11-9bc6-005056bcce7e (working-group report, Oct 2024)
- [I26] https://ns.is/malaflokkar/fasteignakaup/
- [I27] https://web.fasteignir.is/news/show/306
- [I28] https://skemman.is/bitstream/1946/48301/4/Bjorg.Jonsdottir_ML_leidrett_lokaverk.pdf
- [I32] https://www.stjornarradid.is/efst-a-baugi/frettir/stok-frett/2024/10/22/Traustari-fasteignakaup-Skyrsla-starfshops-um-breytingartillogur-a-svidi-fasteignakaupa/
- [I33] https://www.stjornarradid.is/rikisstjorn/thingmalaskra/
- [I35] https://www.visir.is/g/20252725153d/leggja-til-rot-taekar-breytingar-a-byggingaeftirliti
- [I39] https://hms.is/fasteignaskra---askrift
- [I42] https://www.nmi.is/static/files/Vefverslun/Stjornun_og_rekstur/alkalivirkni_steinsteypu.pdf
- [I45] https://www.mbl.is/frettir/innlent/2025/10/30/gallar_i_storum_hluta_nybyggdra_fjolbylishusa/
- [I48] https://hms.is/skyrslur/manadarskyrsla-januar-2026
- [I49] https://www.globalpropertyguide.com/Europe/iceland
- [I53] https://www.mbl.is/vidskipti/frettir/2026/10/21/oseldum_nyjum_ibudum_fjolgar_um_85_prosent/

**Abroad**

- [A1] https://www.bolius.dk/huseftersynsordningen-tilstandsrapport-og-elinstallationsrapport-17757
- [A2] https://www.bolius.dk/ejerskifteforsikring-8909/
- [A8] https://naevneneshus.dk/media/sjopngjq/dkbb-aarsberetning-2025.pdf
- [A10] https://www.nordea.com/no/nyheter/ny-boliglov-fra-nyttar-de-fem-viktigste-endringene-alle-bor-vite-om
- [A11] https://lovdata.no/dokument/SF/forskrift/2021-06-08-1850
- [A15] https://www.smartepenger.no/boligokonomi/456-eierskifteforsikring
- [A16] https://www.boligmappa.no/
- [A21] https://kkv.fi/en/consumer-affairs/housing/a-condition-inspection-and-inspectors/a-condition-inspection
- [A22] https://www.kaleva.fi/kuntotarkastusten-laadussa-on-suurta-vaihtelua-mon/6199060
- [A24] https://www.ekonomifokus.se/bostad/kopa-bostad-guide/forhandsbesiktning-och-overlatelsebesiktning
- [A34] https://www.gov.uk/government/news/lack-of-trust-condemned-hips-to-failure
- [A35] https://www.gov.uk/government/news/hips-failed-because-no-one-trusted-them
- [A36] https://www.spectora.com/pricing
- [A44] https://support.spectora.com/en/articles/3693292-repair-pricer-information
- [A48] https://risk.lexisnexis.com/products/lexisnexis-flyreel
- [A51] https://hover.to/pricing
- [A55] https://www.verisk.com/company/newsroom/tractable-teams-up-with-verisk-to-offer-ai-powered-estimates-for-property-damage/
- [A61] https://www.rics.org/news-insights/rics-first-ever-standard-on-responsible-ai-use-now-in-effect

*Note: some figures come from search-engine excerpts because hms.is, althingi.is and island.is block automated fetching. Check key numbers by hand before using them externally.*
