/**
 * Dimensions and layout of the procedural house, in metres. Pure data and math (no three.js),
 * shared by the 3D model (houseModel.ts), the hotspot anchors (anchors.ts) and the SVG fallback
 * (StaticHouse.tsx), so the fallback and the 3D scene show the same house from the same angle.
 *
 * Axes: x to the right along the front, y up, z towards the viewer. The footprint is centred on
 * the origin; the front façade faces +z and the ridge runs along x.
 */

export type Vec3 = readonly [number, number, number];
export type Side = "front" | "back" | "left" | "right";

const DEG = Math.PI / 180;

export const H = {
  /** Half the outer width along x and half the outer depth along z. */
  halfW: 5,
  halfD: 3.5,
  wallT: 0.25,
  /** Foundation plinth (sökkull): top height and how far it stands proud of the wall. */
  plinthTop: 0.6,
  plinthOut: 0.05,
  /** Walls start a little below the plinth top so door openings stay inside the wall outline. */
  wallBase: 0.45,
  /** Upper-floor level and the top of the front and back walls. */
  floor2: 3.4,
  eave: 6.0,
  pitch: 30 * DEG,
  eaveOverhang: 0.45,
  gableOverhang: 0.3,
  roofSlab: 0.15,
} as const;

export const TAN_PITCH = Math.tan(H.pitch);
export const COS_PITCH = Math.cos(H.pitch);
export const SIN_PITCH = Math.sin(H.pitch);

/** Underside of the roof slab at depth z (the gable walls follow this line). */
export function roofUnderY(z: number): number {
  return H.eave + (H.halfD - Math.abs(z)) * TAN_PITCH;
}
/** Top of the roof slab (the corrugated sheet sits on it). */
export function roofTopY(z: number): number {
  return roofUnderY(z) + H.roofSlab / COS_PITCH;
}
export const RIDGE_TOP = roofTopY(0);
/** Horizontal reach of the eave and the length of one roof slope measured along the slope. */
export const EAVE_Z = H.halfD + H.eaveOverhang;
export const SLOPE_LEN = EAVE_Z / COS_PITCH;
export const ROOF_HALF_LEN = H.halfW + H.gableOverhang;
/** Height of the slab top at the eave edge. */
export const EAVE_TOP_Y = RIDGE_TOP - SLOPE_LEN * SIN_PITCH;

/** Chimney footprint centre and top. */
export const CHIMNEY = { x: -4.15, z: -0.75, size: 0.72, top: RIDGE_TOP + 0.75 } as const;

/** Raised timber deck on the right-hand side, with a round hot tub (heitur pottur). */
export const DECK = { x0: H.halfW + 0.02, x1: 8.7, z0: -2.7, z1: 2.5, top: 0.45 } as const;
export const TUB = { x: 7.15, z: -0.95, r: 1.02, rim: 0.82, water: 0.72 } as const;

/** Cantilevered balcony on the upper floor of the front. */
export const BALCONY = { x0: 0.25, x1: 2.85, depth: 1.35, top: H.floor2 - 0.02, thick: 0.16, rail: 1.0 } as const;

/** Front door steps and canopy. */
export const ENTRANCE = { x: -1.45, w: 1.0 } as const;

export type OpeningKind = "window" | "door" | "glassDoor" | "frosted" | "vent";
export interface Opening {
  /** Centre along the wall's horizontal axis, as seen from outside (left to right). */
  u: number;
  /** Bottom edge (absolute height) and size. */
  y: number;
  w: number;
  h: number;
  kind: OpeningKind;
}

const GF_SILL = 1.45;
const UF_SILL = 4.2;

/**
 * Openings per side. The horizontal axis "u" of each wall runs left to right as seen from
 * outside: front u = x, right u = -z, back u = -x, left u = z.
 */
export const OPENINGS: Record<Side, Opening[]> = {
  front: [
    { u: -3.55, y: GF_SILL, w: 1.5, h: 1.3, kind: "window" },
    { u: ENTRANCE.x, y: H.plinthTop, w: ENTRANCE.w, h: 2.2, kind: "door" },
    { u: 1.55, y: GF_SILL, w: 1.9, h: 1.3, kind: "window" },
    { u: 3.9, y: GF_SILL, w: 1.1, h: 1.3, kind: "window" },
    { u: -3.55, y: UF_SILL, w: 1.5, h: 1.3, kind: "window" },
    { u: ENTRANCE.x, y: UF_SILL + 0.2, w: 0.8, h: 1.1, kind: "window" },
    { u: 1.55, y: H.floor2, w: 2.0, h: 2.15, kind: "glassDoor" },
    { u: 3.9, y: UF_SILL, w: 1.1, h: 1.3, kind: "window" },
  ],
  right: [
    { u: -1.0, y: H.plinthTop, w: 1.7, h: 2.2, kind: "glassDoor" },
    { u: 1.95, y: GF_SILL, w: 1.0, h: 1.3, kind: "window" },
    { u: -1.0, y: UF_SILL, w: 1.3, h: 1.3, kind: "window" },
    { u: 1.95, y: UF_SILL + 0.55, w: 0.75, h: 0.75, kind: "frosted" },
    { u: 0, y: 6.45, w: 0.5, h: 0.55, kind: "vent" },
  ],
  back: [
    { u: 3.0, y: 1.65, w: 1.6, h: 1.1, kind: "window" },
    { u: -3.3, y: 1.65, w: 0.9, h: 1.0, kind: "window" },
    { u: 3.0, y: UF_SILL, w: 1.4, h: 1.3, kind: "window" },
    { u: 0.1, y: UF_SILL, w: 1.2, h: 1.3, kind: "window" },
    { u: -3.3, y: UF_SILL + 0.55, w: 0.75, h: 0.75, kind: "frosted" },
  ],
  left: [
    { u: 1.8, y: GF_SILL, w: 1.2, h: 1.3, kind: "window" },
    { u: 1.8, y: UF_SILL, w: 1.2, h: 1.3, kind: "window" },
    { u: -1.6, y: UF_SILL, w: 1.0, h: 1.3, kind: "window" },
    { u: 0, y: 6.45, w: 0.5, h: 0.55, kind: "vent" },
  ],
};

/** Outward normal, horizontal axis, distance from the centre to the outer face, and half length. */
export const SIDE_FRAME: Record<Side, { n: Vec3; u: Vec3; out: number; half: number }> = {
  front: { n: [0, 0, 1], u: [1, 0, 0], out: H.halfD, half: H.halfW },
  back: { n: [0, 0, -1], u: [-1, 0, 0], out: H.halfD, half: H.halfW },
  right: { n: [1, 0, 0], u: [0, 0, -1], out: H.halfW, half: H.halfD - H.wallT },
  left: { n: [-1, 0, 0], u: [0, 0, 1], out: H.halfW, half: H.halfD - H.wallT },
};

export const SIDES: Side[] = ["front", "right", "back", "left"];

/** World position of a point on a wall: u along the wall, height y, w outwards from the outer face. */
export function onWall(side: Side, u: number, y: number, w = 0): Vec3 {
  const f = SIDE_FRAME[side];
  return [f.n[0] * (f.out + w) + f.u[0] * u, y, f.n[2] * (f.out + w) + f.u[2] * u];
}

/** Outline of a wall in its own (u, y) plane. Gable walls follow the roof line. */
export function wallOutline(side: Side): [number, number][] {
  const half = SIDE_FRAME[side].half;
  if (side === "front" || side === "back") {
    return [
      [-half, H.wallBase],
      [half, H.wallBase],
      [half, H.eave],
      [-half, H.eave],
    ];
  }
  return [
    [-half, H.wallBase],
    [half, H.wallBase],
    [half, roofUnderY(half)],
    [0, roofUnderY(0)],
    [-half, roofUnderY(half)],
  ];
}

/** Extreme points of the house, deck, steps, balcony, roof and chimney, for framing. */
export const FRAME_POINTS: Vec3[] = (() => {
  const pw = H.halfW + H.plinthOut;
  const pd = H.halfD + H.plinthOut;
  const cs = CHIMNEY.size / 2;
  const pts: Vec3[] = [
    [-pw, 0, -pd],
    [-pw, 0, pd],
    [pw, 0, -pd],
    [DECK.x1, 0, DECK.z0],
    [DECK.x1, 0, DECK.z1],
    [7.7, 0, DECK.z1 + 0.34],
    [ENTRANCE.x - 0.78, 0, H.halfD + 1.67],
    [ENTRANCE.x + 0.78, 0, H.halfD + 1.67],
    [BALCONY.x0, BALCONY.top + BALCONY.rail, H.halfD + BALCONY.depth],
    [BALCONY.x1, BALCONY.top + BALCONY.rail, H.halfD + BALCONY.depth],
    [TUB.x + TUB.r, TUB.rim, TUB.z + TUB.r],
    [CHIMNEY.x - cs - 0.07, CHIMNEY.top + 0.32, CHIMNEY.z - cs],
    [CHIMNEY.x + cs + 0.07, CHIMNEY.top + 0.32, CHIMNEY.z + cs],
    [-ROOF_HALF_LEN, RIDGE_TOP + 0.15, 0],
    [ROOF_HALF_LEN, RIDGE_TOP + 0.15, 0],
  ];
  for (const x of [-ROOF_HALF_LEN - 0.05, ROOF_HALF_LEN + 0.05]) {
    for (const z of [-(EAVE_Z + 0.25), EAVE_Z + 0.25]) pts.push([x, EAVE_TOP_Y, z], [x, EAVE_TOP_Y - 0.3, z]);
  }
  return pts;
})();

/** Default three-quarter view used by the scenes and the SVG fallback (radians). */
export const VIEW = {
  /** Camera azimuth from the front (+z) towards the right (+x). */
  azimuth: 36 * DEG,
  elevation: 22 * DEG,
  /** Point the camera looks at. */
  target: [1.6, 3.6, 0.4] as Vec3,
} as const;

/**
 * Orthographic projection for the SVG fallback: returns screen (x, y) with y down, plus depth
 * (larger = closer to the viewer).
 */
export function makeProjector(azimuth: number, elevation: number) {
  const ca = Math.cos(azimuth);
  const sa = Math.sin(azimuth);
  const ce = Math.cos(elevation);
  const se = Math.sin(elevation);
  // Camera basis: right r, up u, towards-viewer b.
  const r: Vec3 = [ca, 0, -sa];
  const b: Vec3 = [sa * ce, se, ca * ce];
  const up: Vec3 = [-sa * se, ce, -ca * se];
  return (p: Vec3): [number, number, number] => [
    p[0] * r[0] + p[1] * r[1] + p[2] * r[2],
    -(p[0] * up[0] + p[1] * up[1] + p[2] * up[2]),
    p[0] * b[0] + p[1] * b[1] + p[2] * b[2],
  ];
}
