/**
 * Where hotspots sit on the house. Pure data (no three.js), so the SVG fallback can use it too.
 * Positions are in model space (metres, see houseSpec.ts) and sit just outside the surface they
 * describe, so a pin never hides inside its own geometry.
 */
import type { HeroLabelKey } from "./index";
import { BALCONY, CHIMNEY, ENTRANCE, H, TUB, roofTopY, type Vec3 } from "./houseSpec";

/** Interior layout shown in the condition map's cut-away. Shared by the model and the anchors. */
export const INTERIOR = {
  gfSlab: [0.45, H.plinthTop] as const,
  ufSlab: [3.2, H.floor2] as const,
  ceiling: [5.85, H.eave] as const,
  partitionX: 1.8,
  partitionH: 1.1,
  counter: { x0: -4.6, x1: -1.75, z0: -3.25, z1: -2.62, top: 1.5 },
  stairs: { xBottom: 1.55, xTop: -1.25, z0: -3.22, z1: -2.27, steps: 12 },
  tub: { x0: 3.0, x1: 4.72, z0: -3.23, z1: -2.47, top: H.floor2 + 0.55 },
  washer: { x0: 4.05, x1: 4.65, z0: -3.2, z1: -2.6, top: 1.45 },
  tank: { x: 3.3, z: -2.88, r: 0.28, top: 2.05 },
  manifold: { x0: 2.0, x1: 2.75, y0: 1.0, y1: 1.75 },
  pipesX: [2.9, 2.98] as const,
  soilStack: { x: 4.55, z: -2.3 },
  panel: { z0: 0.3, z1: 0.82, y0: 1.5, y1: 2.2 },
  radiator: { z0: 1.3, z1: 2.3, y0: 0.75, y1: 1.3 },
  fireplace: { z0: -1.45, z1: -0.25, top: 1.7 },
  smoke: [-0.6, 5.55] as const,
  fan: [3.75, 5.45] as const,
} as const;

const backInner = -H.halfD + H.wallT;
const leftInner = -H.halfW + H.wallT;

/**
 * Condition-map anchor per checklist key (src/lib/checklist.ts). `null` = shown only in the list
 * (documents have no place on the house).
 */
export const ITEM_ANCHORS: Record<string, Vec3 | null> = {
  // Exterior
  roof: [-1.3, roofTopY(1.9) + 0.08, 1.9],
  gutters: [-4.3, 5.7, H.halfD + H.eaveOverhang + 0.15],
  facade: [H.halfW + 0.04, 6.55, -1.25],
  windows_ext: [-3.55, 2.1, H.halfD + 0.08],
  balcony: [(BALCONY.x0 + BALCONY.x1) / 2, BALCONY.top - 0.05, H.halfD + BALCONY.depth + 0.04],
  foundation_drainage: [-4.55, 0.3, H.halfD + H.plinthOut + 0.04],
  garage: [-6.4, 1.1, 1.6],
  hot_tub: [TUB.x, TUB.rim + 0.06, TUB.z],
  // Interior
  windows_int: [-3.55, 4.9, H.halfD - H.wallT - 0.06],
  walls_ceilings: [-3.85, 5.45, backInner + 0.05],
  floors: [-2.3, H.plinthTop + 0.05, 0.9],
  kitchen: [-3.0, INTERIOR.counter.top + 0.06, -2.92],
  basement_storage: [-0.55, 1.15, -2.72],
  attic: [0.7, 6.95, 0],
  stairs_railings: [0.2, 2.45, -2.27],
  chimney_fireplace: [CHIMNEY.x, CHIMNEY.top + 0.12, CHIMNEY.z],
  crawl_space: [-1.1, 0.28, 2.1],
  // Wet rooms
  bathroom: [3.85, INTERIOR.tub.top + 0.08, -2.85],
  laundry: [4.35, INTERIOR.washer.top + 0.06, -2.9],
  // Systems
  electrical_panel: [leftInner + 0.08, 1.85, 0.56],
  heating_source: [2.38, 1.38, backInner + 0.08],
  hot_water_tank: [INTERIOR.tank.x, INTERIOR.tank.top + 0.07, INTERIOR.tank.z],
  radiators_floorheat: [leftInner + 0.1, 1.02, 1.8],
  water_pipes: [2.94, 2.8, backInner + 0.08],
  sewer: [INTERIOR.soilStack.x, 0.25, INTERIOR.soilStack.z],
  ventilation: [INTERIOR.fan[0], INTERIOR.fan[1], backInner + 0.06],
  fire_safety: [INTERIOR.smoke[0], INTERIOR.smoke[1], backInner + 0.06],
  // Documents
  hoa_statement: null,
};

/** Where unknown keys go: by the front door. Pins that share an anchor are fanned out. */
export const DEFAULT_ANCHOR: Vec3 = [ENTRANCE.x, 1.75, H.halfD + 0.25];

export function anchorForKey(key: string): Vec3 | null {
  return key in ITEM_ANCHORS ? ITEM_ANCHORS[key] : DEFAULT_ANCHOR;
}

/**
 * Resolves anchors for a list of keys. Keys sharing a point are spread on a small ring around it
 * so their pins never sit exactly on top of each other.
 */
/** True when the item has a place on the 3D house (some, like documents, are only listed). */
export const hasAnchor = (key: string) => anchorForKey(key) !== null;

export function resolveAnchors(keys: string[]): Map<string, Vec3> {
  const groups = new Map<string, string[]>();
  const base = new Map<string, Vec3>();
  for (const key of keys) {
    const a = anchorForKey(key);
    if (!a) continue;
    base.set(key, a);
    const id = a.join(",");
    groups.set(id, [...(groups.get(id) ?? []), key]);
  }
  const out = new Map<string, Vec3>();
  for (const members of groups.values()) {
    members.forEach((key, i) => {
      const a = base.get(key)!;
      if (members.length === 1) return out.set(key, a);
      const angle = (i / members.length) * Math.PI * 2;
      out.set(key, [a[0] + Math.cos(angle) * 0.45, a[1] + Math.sin(angle) * 0.45, a[2] + 0.05]);
    });
  }
  return out;
}

const ROOF_N: Vec3 = [0, Math.cos(H.pitch), Math.sin(H.pitch)];

/**
 * Landing-page hotspots: anchor, the outward normal of the surface it sits on (a pin fades when
 * its surface turns away from the camera) and the side its label goes on.
 */
export const HERO_HOTSPOTS: { key: HeroLabelKey; at: Vec3; normal: Vec3; side: "left" | "right" }[] = [
  { key: "roof", at: [-1.4, roofTopY(1.7) + 0.06, 1.7], normal: ROOF_N, side: "left" },
  { key: "windows", at: [-3.55, 4.85, H.halfD + 0.1], normal: [0, 0, 1], side: "left" },
  { key: "wetRooms", at: [H.halfW + 0.06, 5.12, -1.95], normal: [1, 0, 0], side: "right" },
  { key: "facade", at: [H.halfW + 0.04, 3.1, 0.25], normal: [1, 0, 0], side: "right" },
  { key: "technical", at: [-3.78, 0.95, H.halfD + 0.16], normal: [0, 0, 1], side: "left" },
  { key: "foundation", at: [2.85, 0.3, H.halfD + H.plinthOut + 0.04], normal: [0, 0, 1], side: "left" },
];
