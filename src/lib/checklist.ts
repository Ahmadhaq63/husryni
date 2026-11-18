import type { FollowUp, L10n, PropertyProfile } from "./types";

export type Area = "exterior" | "interior" | "wet" | "systems" | "documents";

export const AREA_LABEL: Record<Area, L10n> = {
  exterior: { is: "Að utan", en: "Exterior" },
  interior: { is: "Að innan", en: "Interior" },
  wet: { is: "Votrými", en: "Wet rooms" },
  systems: { is: "Lagnir og kerfi", en: "Pipes and systems" },
  documents: { is: "Gögn", en: "Documents" },
};

export interface ItemTemplate {
  key: string;
  area: Area;
  title: L10n;
  /** Shown to the person taking photos. */
  instructions: L10n;
  /** English guidance for the AI: what to look for on this component. */
  lookFor: string;
  /** Photos needed before the item counts as done (0 = optional item). */
  minPhotos: number;
  appliesTo?: (p: PropertyProfile) => boolean;
}

const isApartment = (p: PropertyProfile) => p.propertyType === "fjolbyli";
const hasAssociation = (p: PropertyProfile) =>
  p.propertyType === "fjolbyli" || p.propertyType === "radhus" || p.propertyType === "parhus";

export const ITEM_TEMPLATES: ItemTemplate[] = [
  // ---------- Exterior ----------
  {
    key: "roof",
    area: "exterior",
    title: { is: "Þak og þakkantur", en: "Roof and eaves" },
    instructions: {
      is: "Taktu 2–3 myndir af þakinu frá jörðu eða út um glugga: heildarmynd, nærmynd af klæðningu (t.d. bárujárni) og af þakkanti. Farðu ekki upp á þak. Í fjölbýli er þakið sameign — merktu óaðgengilegt ef það sést ekki.",
      en: "Take 2–3 photos of the roof from the ground or a window: an overview, a close-up of the covering (e.g. corrugated iron) and the eaves. Do not climb onto the roof. In apartment buildings the roof is shared — mark it not accessible if you cannot see it.",
    },
    lookFor:
      "Roof covering condition: rust on corrugated iron, loose or missing fasteners, dents, failed paint; blistering or ponding on flat roofs; moss. Flashings around chimneys and vents. Excess sealant or tar patches (signs of earlier leaks). Rot or paint failure on fascia/eaves; eave vents blocked or painted over. Sagging ridge or roof lines. Asbestos-cement sheets on older roofs (do not disturb).",
    minPhotos: 2,
  },
  {
    key: "gutters",
    area: "exterior",
    title: { is: "Þakrennur og niðurföll", en: "Gutters and downpipes" },
    instructions: {
      is: "Myndaðu þakrennur og niðurfallsrör, sérstaklega samskeyti og þar sem rörin enda við jörð.",
      en: "Photograph gutters and downpipes, especially joints and where the pipes end at ground level.",
    },
    lookFor:
      "Rust, leaking joints, overflow staining on the wall below, loose brackets, downpipes discharging against the foundation, frost/ice damage.",
    minPhotos: 1,
  },
  {
    key: "facade",
    area: "exterior",
    title: { is: "Útveggir og múr", en: "Exterior walls and render" },
    instructions: {
      is: "Myndaðu allar hliðar hússins (í fjölbýli: þína hlið og inngang) og taktu nærmyndir af sprungum, flögnun, ryðtaumum eða rakablettum.",
      en: "Photograph every side of the building (apartments: your side and the entrance) and take close-ups of cracks, spalling, rust streaks or damp patches.",
    },
    lookFor:
      "Crack type and pattern (hairline shrinkage vs. structural; map cracking typical of alkali–silica reaction in older Icelandic concrete), frost spalling, exposed or rusting rebar, efflorescence, detached render, paint failure, damp staining, rot in timber cladding. Walls bowing or window/door openings out of square (movement). Vegetation growing on or touching the walls; timber cladding in contact with the ground.",
    minPhotos: 2,
  },
  {
    key: "windows_ext",
    area: "exterior",
    title: { is: "Gluggar og hurðir að utan", en: "Windows and doors (outside)" },
    instructions: {
      is: "Myndaðu glugga að utan, sérstaklega neðri hluta karma, sólbekki og kíttisfúgur. Taktu nærmynd af versta glugganum og af útidyrum.",
      en: "Photograph windows from outside, especially the lower frame corners, sills and sealant joints. Take a close-up of the worst window and of the entrance door.",
    },
    lookFor:
      "Rot or soft timber in frames and sills (lower corners first), failed putty or sealant, flaking paint, gaps between frame and wall, missing drip flashing above windows, rusting metal parts, damaged exterior doors and thresholds.",
    minPhotos: 2,
  },
  {
    key: "balcony",
    area: "exterior",
    title: { is: "Svalir, pallur og tröppur", en: "Balconies, decks and steps" },
    instructions: {
      is: "Myndaðu svalagólf (sérstaklega brúnir og niðurfall), handrið og undirhlið svala ef hún sést. Merktu óaðgengilegt ef engar svalir eru.",
      en: "Photograph the balcony floor (especially edges and drain), the railing and the underside if visible. Mark not accessible if there is no balcony.",
    },
    lookFor:
      "Concrete spalling at slab edges, exposed or rusting rebar, failed waterproofing, blocked drains, loose or corroded railings (fall hazard), rot in timber decks and steps.",
    minPhotos: 1,
  },
  {
    key: "foundation_drainage",
    area: "exterior",
    title: { is: "Sökkull, lóð og drenlögn", en: "Foundation, grounds and drainage" },
    instructions: {
      is: "Gakktu hringinn og myndaðu sökkulinn og halla lóðarinnar við húsið. Myndaðu brunna og niðurföll á lóð ef þau sjást.",
      en: "Walk around the house and photograph the foundation and how the ground slopes next to it. Photograph drainage wells and yard drains if visible.",
    },
    lookFor:
      "Ground, driveway or patio sloping toward the house, standing water, damp or efflorescence on the foundation, foundation cracks, missing splash protection, condition of drainage wells, trees or bushes touching the house or overhanging the roof.",
    minPhotos: 2,
    appliesTo: (p) => !isApartment(p),
  },

  {
    key: "garage",
    area: "exterior",
    title: { is: "Bílskúr", en: "Garage" },
    instructions: {
      is: "Myndaðu bílskúrshurð, gólf (sprungur, raki), veggi og loft, og rafmagn í bílskúrnum.",
      en: "Photograph the garage door, floor (cracks, damp), walls and ceiling, and the garage's electrics.",
    },
    lookFor:
      "Garage door condition and whether an automatic opener looks safe, cracks or damp in the floor slab, leaks from the roof, damp or efflorescence on walls, amateur electrical work, fire separation between garage and dwelling.",
    minPhotos: 2,
    appliesTo: (p) => !!p.hasGarage,
  },
  {
    key: "hot_tub",
    area: "exterior",
    title: { is: "Heitur pottur", en: "Hot tub" },
    instructions: {
      is: "Myndaðu pottinn, lokið, pallinn umhverfis hann og tengingar (loka, blöndunartæki, affall) ef þær sjást.",
      en: "Photograph the tub, its cover, the deck around it and the connections (valves, mixing valve, drain) if visible.",
    },
    lookFor:
      "Cracks in the shell, worn or broken cover (safety for children), rot in the surrounding deck, leaks at connections, presence of a mixing/thermostatic valve (geothermal water can scald), electrical safety (RCD) for electric tubs and pumps.",
    minPhotos: 1,
    appliesTo: (p) => !!p.hasHotTub,
  },

  // ---------- Interior ----------
  {
    key: "windows_int",
    area: "interior",
    title: { is: "Gluggar að innan", en: "Windows (inside)" },
    instructions: {
      is: "Myndaðu glugga að innan: gluggakistur, horn karma og gler. Myndaðu sérstaklega móðu milli glerja eða svarta bletti.",
      en: "Photograph windows from inside: sills, frame corners and glass. Especially capture fogging between panes or black spots.",
    },
    lookFor:
      "Fogging between panes (failed sealed glazing unit), water staining or mould on sills and frame corners, swollen timber sills, gaps suggesting draughts, broken handles or hinges.",
    minPhotos: 2,
  },
  {
    key: "walls_ceilings",
    area: "interior",
    title: { is: "Veggir og loft", en: "Walls and ceilings" },
    instructions: {
      is: "Gakktu um öll herbergi og myndaðu bletti, sprungur, flögnun eða mislitun á veggjum og í loftum, sérstaklega við útveggi og undir baðherbergjum.",
      en: "Walk through every room and photograph stains, cracks, peeling or discolouration on walls and ceilings, especially along exterior walls and under bathrooms.",
    },
    lookFor:
      "Water rings on ceilings (roof or upstairs wet-room leaks), mould in cold corners of exterior walls or behind furniture, crack patterns (settlement vs. shrinkage; cracks radiating from door and window corners), bubbling paint, damp patches. Owner notes about doors that stick or won't latch suggest movement.",
    minPhotos: 2,
  },
  {
    key: "floors",
    area: "interior",
    title: { is: "Gólf", en: "Floors" },
    instructions: {
      is: "Myndaðu gólfefni í helstu rýmum. Ef parket er bólgið, sprungið eða mislitað, taktu nærmynd.",
      en: "Photograph the flooring in the main rooms. If parquet is swollen, cracked or discoloured, take a close-up.",
    },
    lookFor:
      "Cupped or swollen parquet (moisture from below or from leaks), staining near kitchen and bathroom, cracked tiles, uneven floors, traces of earlier water damage.",
    minPhotos: 1,
  },
  {
    key: "kitchen",
    area: "interior",
    title: { is: "Eldhús", en: "Kitchen" },
    instructions: {
      is: "Opnaðu skápinn undir vaskinum og myndaðu lagnir og botn skápsins. Myndaðu líka svæðið við uppþvottavél og ísskáp.",
      en: "Open the cabinet under the sink and photograph the pipes and cabinet floor. Also photograph the area around the dishwasher and fridge.",
    },
    lookFor:
      "Leaks or water damage under the sink (swollen cabinet base, stains), corroded connections, missing shut-off valves, water damage near dishwasher or fridge, extractor hood present and whether it is ducted outdoors or only recirculates.",
    minPhotos: 2,
  },
  {
    key: "basement_storage",
    area: "interior",
    title: { is: "Kjallari og geymsla", en: "Basement and storage" },
    instructions: {
      is: "Myndaðu veggi og gólf í kjallara eða geymslu, sérstaklega neðri hluta veggja. Ef það er fúkkalykt, skráðu það í athugasemd.",
      en: "Photograph walls and floor in the basement or storage room, especially the lower part of the walls. If it smells musty, write that in the notes.",
    },
    lookFor:
      "Damp walls, efflorescence (white salt deposits), tide marks, mould, paint peeling at the base of walls, water entering at the wall–floor joint, rot in visible structural timber. Owner notes about musty smell are strong evidence.",
    minPhotos: 2,
    appliesTo: (p) => p.hasBasement || isApartment(p),
  },
  {
    key: "attic",
    area: "interior",
    title: { is: "Háaloft / ris", en: "Attic / loft" },
    instructions: {
      is: "Ef óhætt er að líta upp á háaloft: myndaðu klæðningu þaksins að innan, einangrun og loftun. Annars merktu óaðgengilegt.",
      en: "If it is safe to look into the attic: photograph the underside of the roof boards, the insulation and ventilation. Otherwise mark it not accessible.",
    },
    lookFor:
      "Dark staining or mould on roof boards (poor ventilation or leaks), daylight or drip marks, wet or compressed insulation, pest signs, ventilation openings. Bathroom or kitchen exhaust ducts ending in the attic instead of outdoors (a common cause of attic mould). Open electrical splices.",
    minPhotos: 2,
    appliesTo: (p) => p.hasAttic,
  },

  {
    key: "stairs_railings",
    area: "interior",
    title: { is: "Stigar og handrið (valkvætt)", en: "Stairs and railings (optional)" },
    instructions: {
      is: "Ef stigar eru í eigninni: myndaðu þrep, handrið og rimla, bæði inni og úti.",
      en: "If the property has stairs: photograph the treads, handrails and balusters, inside and outside.",
    },
    lookFor: "Loose or missing handrails, gaps in balusters wide enough for a child, worn or loose treads, steps without a handrail (fall hazards).",
    minPhotos: 0,
  },
  {
    key: "chimney_fireplace",
    area: "interior",
    title: { is: "Arinn og reykháfur", en: "Fireplace and chimney" },
    instructions: {
      is: "Myndaðu arininn (op, steinhleðslu, spjald ef það sést) og reykháfinn að utan ef hægt er.",
      en: "Photograph the fireplace (opening, masonry, damper if visible) and the chimney from outside if possible.",
    },
    lookFor:
      "Cracked masonry or mortar, soot staining on the face of the fireplace (back-drafting), damaged chimney cap or flashing, missing spark guard. Recommend a chimney sweep / inspection when use is planned.",
    minPhotos: 1,
    appliesTo: (p) => !!p.hasFireplace,
  },
  {
    key: "crawl_space",
    area: "interior",
    title: { is: "Skriðrými og undirstöður", en: "Crawl space and foundations" },
    instructions: {
      is: "Ef hægt er að líta undir húsið: myndaðu undirstöður, burðarbita, einangrun og loftun. Annars merktu óaðgengilegt.",
      en: "If you can look under the house: photograph the foundations, beams, insulation and ventilation. Otherwise mark it not accessible.",
    },
    lookFor:
      "Rot or insect damage in beams and posts, timber touching the ground, damp or standing water, missing ventilation, fallen or wet insulation, uninsulated water pipes (frost risk), settlement of posts or piles.",
    minPhotos: 1,
    appliesTo: (p) => p.propertyType === "sumarhus" || p.construction === "timbur",
  },

  // ---------- Wet rooms ----------
  {
    key: "bathroom",
    area: "wet",
    title: { is: "Baðherbergi", en: "Bathroom" },
    instructions: {
      is: "Myndaðu sturtu eða baðkar, flísar og fúgur, kítti í hornum, gólfniðurfall og loftið fyrir ofan sturtu. Taktu nærmynd af öllum blettum og sprungum.",
      en: "Photograph the shower or bath, tiles and grout, sealant in corners, the floor drain and the ceiling above the shower. Take close-ups of any stains or cracks.",
    },
    lookFor:
      "Cracked tiles or grout, failed silicone joints, mould in grout or ceiling, floor drain condition and floor slope, signs of leaks behind tiles (loose tiles, stains on the outside of the wall), stains or soft flooring around the toilet base, extract fan present (and not ducted into the attic).",
    minPhotos: 3,
  },
  {
    key: "laundry",
    area: "wet",
    title: { is: "Þvottaaðstaða", en: "Laundry area" },
    instructions: {
      is: "Myndaðu gólf og niðurfall, tengingar þvottavélar og vegginn á bak við.",
      en: "Photograph the floor and drain, the washing-machine connections and the wall behind.",
    },
    lookFor: "Floor drain present and in order, leaking hoses or valves, moisture damage on floor or walls, mould.",
    minPhotos: 1,
  },

  // ---------- Systems ----------
  {
    key: "electrical_panel",
    area: "systems",
    title: { is: "Rafmagnstafla", en: "Electrical panel" },
    instructions: {
      is: "Opnaðu lokið á rafmagnstöflunni (snertu ekkert inni í henni) og taktu mynd af allri töflunni og merkingum. Ef þú treystir þér til: ýttu á prófunarhnapp lekaliðans (merktur T) — rafmagnið á að slá út. Skráðu niðurstöðuna í athugasemd.",
      en: "Open the electrical panel door (do not touch anything inside) and photograph the whole panel and its labels. If you're comfortable doing so: press the RCD's test button (marked T) — the power should cut out. Note the result.",
    },
    lookFor:
      "Old screw-in fuses vs. circuit breakers, presence of an RCD (lekaliði / residual current device), labelling, scorch or heat marks, open slots or missing covers, amateur wiring, signs of age, signs of missing earthing (old cloth-insulated wiring, two-pin outlets). Current rules require a 30 mA RCD in dwellings and no longer allow type AC on lighting/socket circuits; HMS found about 10% of older RCDs faulty, so report the owner's RCD test result if given.",
    minPhotos: 1,
  },
  {
    key: "heating_source",
    area: "systems",
    title: { is: "Hitaveitugrind / hitagjafi", en: "Heating manifold / heat source" },
    instructions: {
      is: "Myndaðu hitaveitugrindina eða inntakið (loka, þrýstijafnara, mæla og rör) — eða varmadælu/hitatæki. Nærmynd af ryði eða leka.",
      en: "Photograph the district-heating manifold or service entry (valves, pressure reducer, gauges, pipes) — or the heat pump / heater. Close-ups of rust or leaks.",
    },
    lookFor:
      "Corrosion, leaks or mineral deposits on valves and fittings, presence of a pressure-reducing valve and of a thermostatic mixing valve on the domestic hot water (geothermal water is hot enough to scald), gauges, pipe insulation, age of the installation, amateur modifications.",
    minPhotos: 1,
  },
  {
    key: "hot_water_tank",
    area: "systems",
    title: { is: "Hitakútur (neysluvatn)", en: "Hot-water tank" },
    instructions: {
      is: "Myndaðu hitakútinn, merkiplötuna (aldur), öryggisloka og tengingar.",
      en: "Photograph the hot-water tank, its rating plate (age), the safety valve and the connections.",
    },
    lookFor: "Rust or leaks at the tank and connections, presence of a safety/pressure-relief valve with a drain, age from the rating plate, amateur electrical connections.",
    minPhotos: 1,
    appliesTo: (p) => p.heating !== "hitaveita",
  },
  {
    key: "radiators_floorheat",
    area: "systems",
    title: { is: "Ofnar og gólfhiti", en: "Radiators and underfloor heating" },
    instructions: {
      is: "Myndaðu ofna (sérstaklega loka og tengingar) og stjórnbúnað gólfhita ef hann er til staðar.",
      en: "Photograph radiators (especially valves and connections) and the underfloor-heating controls if present.",
    },
    lookFor: "Rust or leaks at radiator valves, corrosion streaks, missing thermostatic valves, condition of the floor-heating manifold.",
    minPhotos: 1,
  },
  {
    key: "water_pipes",
    area: "systems",
    title: { is: "Neysluvatnslagnir", en: "Water supply pipes" },
    instructions: {
      is: "Myndaðu sýnilegar vatnslagnir (t.d. undir vaski, í þvottahúsi eða við inntak) svo efnið sjáist. Skráðu ef vatnið er brúnleitt þegar skrúfað er frá.",
      en: "Photograph visible water pipes (e.g. under the sink, in the laundry or at the entry) so the material can be seen. Note if the water runs brownish at first.",
    },
    lookFor: "Pipe material (galvanised steel, copper, PEX/plastic), corrosion, leaks, discoloured water or weak flow reported by the owner (corroded galvanised pipes), old joints. Old pipe insulation that may contain asbestos (do not disturb).",
    minPhotos: 1,
  },
  {
    key: "sewer",
    area: "systems",
    title: { is: "Skólplagnir og niðurföll", en: "Sewer pipes and drains" },
    instructions: {
      is: "Myndaðu sýnilegar skólplagnir og hreinsilúgur (t.d. í kjallara eða þvottahúsi). Skráðu í athugasemd ef niðurföll eru hæg eða ólykt kemur upp.",
      en: "Photograph visible sewer pipes and clean-outs (e.g. in the basement or laundry). Note if drains are slow or there is a sewage smell.",
    },
    lookFor:
      "Pipe material (cast iron, clay, concrete, PVC), cracks, leaks, corrosion, backflow traces. Old sewer pipes are a very common hidden defect; most of the pipe is not visible, so recommend a camera inspection when age or symptoms warrant it.",
    minPhotos: 1,
  },
  {
    key: "ventilation",
    area: "systems",
    title: { is: "Loftræsing og raki", en: "Ventilation and humidity" },
    instructions: {
      is: "Myndaðu loftræsiristar og viftur í eldhúsi og á baði. Ef oft myndast móða á gluggum, skráðu það í athugasemd.",
      en: "Photograph vents and extract fans in the kitchen and bathroom. If windows often fog up, write that in the notes.",
    },
    lookFor: "Extract ventilation in kitchen and bathroom, blocked vents, condensation traces, mould in cold corners suggesting poor ventilation.",
    minPhotos: 1,
  },
  {
    key: "fire_safety",
    area: "systems",
    title: { is: "Brunavarnir", en: "Fire safety" },
    instructions: {
      is: "Myndaðu reykskynjara, slökkvitæki og eldvarnarteppi ef þau eru til staðar, og flóttaleiðir.",
      en: "Photograph smoke detectors, fire extinguisher and fire blanket if present, and escape routes.",
    },
    lookFor: "Smoke detectors in hallway and bedrooms, extinguisher and fire blanket, clear escape routes, fire doors in multi-unit buildings, a carbon-monoxide detector where there is a fireplace, wood stove or gas appliance. Building regulation: every dwelling needs a smoke detector and a fire extinguisher, with at least one detector per floor and per 80 m².",
    minPhotos: 1,
  },

  // ---------- Documents ----------
  {
    key: "hoa_statement",
    area: "documents",
    title: { is: "Yfirlýsing húsfélags (valkvætt)", en: "Owners' association statement (optional)" },
    instructions: {
      is: "Ef þú ert með yfirlýsingu húsfélags (frá fasteignasala eða húsfélagi), taktu mynd af henni. Hún sýnir fyrirhugaðar framkvæmdir og stöðu framkvæmdasjóðs.",
      en: "If you have the owners' association statement (from the realtor or association), photograph it. It lists planned works and the maintenance fund balance.",
    },
    lookFor:
      "This is a document, not a building photo. Extract planned or ongoing common works (roof, facade, windows, sewer), approved levies, fund balance and any defects or disputes mentioned. Grade only what the document says.",
    minPhotos: 0,
    appliesTo: hasAssociation,
  },
];

const TEMPLATE_BY_KEY = new Map(ITEM_TEMPLATES.map((t) => [t.key, t]));

export function getTemplate(key: string): ItemTemplate | undefined {
  return TEMPLATE_BY_KEY.get(key);
}

/** The checklist for a property: applicable templates in display order. */
export function buildChecklist(profile: PropertyProfile): ItemTemplate[] {
  return ITEM_TEMPLATES.filter((t) => !t.appliesTo || t.appliesTo(profile));
}

// ---------------------------------------------------------------------------
// Era / profile risk notes. Shown to the user as focus points and given to the
// AI as context. They describe common patterns, not facts about this property.
// ---------------------------------------------------------------------------

export interface RiskNote {
  id: string;
  text: L10n;
  /** English text for the AI prompt. */
  ai: string;
  itemKeys: string[];
}

export function riskNotes(p: PropertyProfile, currentYear = new Date().getFullYear()): RiskNote[] {
  const notes: RiskNote[] = [];
  const age = currentYear - p.buildYear;

  // Alkali–silica reaction: Reykjavík houses built c. 1960–75 were affected; none built after 1979 (NMÍ survey).
  if (p.construction === "steypa" && p.buildYear >= 1958 && p.buildYear <= 1979) {
    notes.push({
      id: "asr",
      text: {
        is: "Steypa frá árunum um 1960–1979 getur verið með alkalískemmdum (netsprungum). Skoðaðu útveggi og svalir vel.",
        en: "Concrete from roughly 1960–1979 may have alkali–silica damage (map cracking). Check exterior walls and balconies closely.",
      },
      ai: "Concrete from c. 1960–1979 in Iceland is known for alkali–silica reaction; map-pattern cracking on walls or balconies may indicate it.",
      itemKeys: ["facade", "balcony"],
    });
  }
  if (p.buildYear < 1985) {
    notes.push({
      id: "old_pipes",
      text: {
        is: "Í eldri húsum eru oft upprunalegar galvaníseraðar vatnslagnir og skólplagnir sem eru komnar á tíma, nema þær hafi verið endurnýjaðar.",
        en: "Older homes often still have original galvanised water pipes and sewer pipes near the end of their life, unless they have been renewed.",
      },
      ai: "Homes of this age often have original galvanised steel water pipes and old cast-iron, clay or concrete sewer pipes unless renewed; corrosion and sewer damage are common hidden defects.",
      itemKeys: ["water_pipes", "sewer"],
    });
  }
  // Asbestos: imports banned 1983 (total ban 2005); common c. 1955–1980 in corrugated asbestos-cement
  // roof/wall sheets and in insulation on hot-water pipes. It cannot be identified by eye.
  if (p.buildYear >= 1950 && p.buildYear <= 1985) {
    notes.push({
      id: "asbestos",
      text: {
        is: "Hús frá um 1950–1983 geta innihaldið asbest, t.d. í bylgjuðum asbestplötum á þaki eða veggjum og í einangrun hitaveitulagna. Asbest sést ekki með berum augum — ekki bora eða saga í grunsamleg efni; láta þarf greina sýni og fagfólk fjarlægja það.",
        en: "Homes from about 1950–1983 may contain asbestos, e.g. corrugated asbestos-cement roof or wall sheets and insulation on hot-water pipes. It can't be identified by eye — don't drill or cut suspect materials; have samples tested and use trained contractors for removal.",
      },
      ai: "Buildings from c. 1950–1983 may contain asbestos (imports banned in Iceland in 1983): corrugated asbestos-cement roof/wall sheets and hot-water pipe insulation. It cannot be identified visually; if such materials appear, mention possible asbestos and advise sampling before any drilling, cutting or removal.",
      itemKeys: ["roof", "facade", "attic", "water_pipes", "heating_source"],
    });
  }
  if (p.buildYear < 1980) {
    notes.push({
      id: "old_electrical",
      text: {
        is: "Eldri raflagnir og töflur eru oft án lekaliða.",
        en: "Older electrical installations often lack an RCD (residual current device).",
      },
      ai: "Electrical installations of this age often lack RCD protection and may still use screw-in fuses.",
      itemKeys: ["electrical_panel"],
    });
  }
  // New builds: in a 2025 survey of 104 associations in buildings from 2014–2022, ~40% had paid for defect
  // repairs, and leaking windows are reported to be common in new construction.
  if (age <= 12) {
    notes.push({
      id: "recent_build",
      text: {
        is: "Nýleg eign: gallar eru algengir í nýbyggingum, ekki síst leki með gluggum og í votrýmum. Frávik geta fallið undir ábyrgð byggingaraðila — skráðu þau vel.",
        en: "Recent build: defects are common in new construction, especially leaks around windows and in wet rooms. Deviations may fall under the builder's liability — record them carefully.",
      },
      ai: "Recently built: surveys of recent Icelandic apartment buildings found defects common (about 40% of owners' associations had paid for defect repairs) and window leaks frequent. Record workmanship deviations precisely; they may be builder-liability matters.",
      itemKeys: ["windows_ext", "windows_int", "bathroom"],
    });
  }
  if (p.heating === "hitaveita") {
    notes.push({
      id: "district_heating",
      text: {
        is: "Hitaveita: athugaðu hitaveitugrind, loka og þrýstijafnara. Neysluvatn á ekki að fara yfir 65 °C við töppunarstað og á baðherbergjum eiga að vera hitastýrð blöndunartæki þar sem hætta er á bruna (byggingarreglugerð, gr. 14.5.10).",
        en: "District heating: check the manifold, valves and pressure-reducing valve. Tap hot water must not exceed 65 °C, and bathrooms need thermostatic mixers where scalding is possible (building regulation, art. 14.5.10).",
      },
      ai: "Geothermal district heating: water arrives at about 70–80 °C and high pressure. Building regulation art. 14.5.10 requires tap hot water at or below 65 °C via a heat exchanger or mixing valve, and thermostatic mixers in bathrooms where scalding is possible. Corroded valves, a missing pressure-reducing or mixing valve, or leaking fittings are relevant.",
      itemKeys: ["heating_source", "radiators_floorheat"],
    });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Baseline recommendations that follow from age/profile alone, regardless of
// what the photos show (most sewer pipe is never visible in a photo).
// ---------------------------------------------------------------------------

export interface BaselineRecommendation {
  followUp: FollowUp;
  reason: L10n;
}

export function baselineRecommendations(p: PropertyProfile, currentYear = new Date().getFullYear()): BaselineRecommendation[] {
  const recs: BaselineRecommendation[] = [];
  const age = currentYear - p.buildYear;
  if (age >= 30) {
    recs.push({
      followUp: "sewer_camera",
      reason: {
        is: `Eignin er um ${age} ára. Skólplagnir sjást að mestu ekki á myndum og myndun lagna er ráðlögð fyrir kaup nema staðfest sé að þær hafi verið endurnýjaðar.`,
        en: `The property is about ${age} years old. Sewer pipes are mostly invisible in photos; a camera inspection is advisable before purchase unless renewal is documented.`,
      },
    });
  }
  if (p.buildYear < 1980) {
    recs.push({
      followUp: "electrician",
      reason: {
        is: "Raflagnir frá þessum tíma eru oft komnar á tíma. Úttekt rafvirkja er ráðlögð ef ekki liggur fyrir að þær hafi verið endurnýjaðar.",
        en: "Wiring of this age is often due for renewal. An electrician's check is advisable unless renewal is documented.",
      },
    });
  }
  return recs;
}
