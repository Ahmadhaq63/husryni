/**
 * Procedural, stylised Icelandic two-storey concrete house (steinsteypt) with a corrugated-iron
 * gable roof (bárujárn), built from plain three.js geometry. Looks like an architect's model:
 * matte materials, crisp white trim. Roughly 10k triangles with the interior.
 *
 * Meshes are grouped per wall side so the condition map can fade the walls that face the camera.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { INTERIOR } from "./anchors";
import {
  BALCONY,
  CHIMNEY,
  COS_PITCH,
  DECK,
  EAVE_TOP_Y,
  EAVE_Z,
  ENTRANCE,
  H,
  OPENINGS,
  RIDGE_TOP,
  ROOF_HALF_LEN,
  SIDES,
  SIDE_FRAME,
  SIN_PITCH,
  SLOPE_LEN,
  TUB,
  roofTopY,
  wallOutline,
  type Side,
  type Vec3,
} from "./houseSpec";
import { concreteTexture, glassTexture } from "./textures";

export type Palette = "hero" | "map";

const PALETTES = {
  hero: {
    wall: "#ece9e2",
    plinth: "#b5afa5",
    roof: "#9e3529",
    ridge: "#842c22",
    trim: "#fbfaf7",
    door: "#7b5a3e",
    deck: "#b89d7c",
    deckSide: "#8b7660",
    tubShell: "#d6dad9",
    water: "#6fa9ba",
    metal: "#353c3f",
    gutter: "#aab1b3",
    cap: "#7a756e",
    frosted: "#cbd6da",
  },
  map: {
    wall: "#eef0ee",
    plinth: "#c3c5c1",
    roof: "#5a646c",
    ridge: "#4a535a",
    trim: "#fbfbfa",
    door: "#93806c",
    deck: "#cfc2b0",
    deckSide: "#aa9c8a",
    tubShell: "#dfe2e1",
    water: "#a6c6cf",
    metal: "#4b5357",
    gutter: "#b5bbbd",
    cap: "#8d8983",
    frosted: "#d8dfe2",
  },
} as const;

const INTERIOR_COLORS = {
  floor: "#e6dccd",
  partition: "#f6f6f3",
  fixture: "#fbfbfa",
  counterTop: "#8e8a83",
  dark: "#3d4447",
  copper: "#b8794a",
  pipe: "#8e979b",
  board: "#dccaa9",
  basin: "#d5e2e7",
} as const;

/** A set of meshes that fades out when its outward normal faces the camera. */
export interface Ghostable {
  normal: THREE.Vector3;
  /** Materials to fade, with their opaque opacity. */
  materials: THREE.Material[];
  /** Outline shown while faded. */
  lines: THREE.LineBasicMaterial;
  /** Opacity when fully faded. */
  minOpacity: number;
  /** Current fade, 0 = solid, 1 = ghosted. */
  amount: number;
}

export interface HouseModel {
  group: THREE.Group;
  ghostables: Ghostable[];
  /** Every standard material of the house (the hero's scan effect hooks into these). */
  materials: THREE.MeshStandardMaterial[];
}

export interface HouseOptions {
  palette: Palette;
  /** Cut-away mode: interior fixtures, fading walls with outlines. */
  interior: boolean;
}

// ------------------------------------------------------------------ geometry helpers

function boxG(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** Cylinder of radius r between two points. */
function pipeG(a: Vec3, b: Vec3, r: number, segments = 8): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), segments, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

/** Merges geometries into one (fewer draw calls). Inputs are disposed. */
function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    for (const name of Object.keys(n.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") n.deleteAttribute(name);
    }
    return n;
  });
  const out = mergeGeometries(prepared, false);
  prepared.forEach((g) => g.dispose());
  if (!out) throw new Error("mergeGeometries failed");
  return out;
}

function sideMatrix(side: Side): THREE.Matrix4 {
  const f = SIDE_FRAME[side];
  const n = new THREE.Vector3(...f.n);
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.u), new THREE.Vector3(0, 1, 0), n);
  m.setPosition(n.multiplyScalar(f.out));
  return m;
}

// ------------------------------------------------------------------ builder

export function buildHouse({ palette, interior }: HouseOptions): HouseModel {
  const P = PALETTES[palette];
  const group = new THREE.Group();
  group.name = "house";
  const materials: THREE.MeshStandardMaterial[] = [];
  const ghostables: Ghostable[] = [];
  const cutaway = interior;

  const concrete = concreteTexture();
  const glassTex = glassTexture();

  const std = (color: string, roughness = 0.92, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    materials.push(m);
    return m;
  };

  // `transparent` is compiled into the shader program, so fading materials are transparent from
  // the start and only their opacity changes.
  const addGhostable = (normal: THREE.Vector3, mats: THREE.Material[], lines: THREE.LineBasicMaterial, minOpacity: number) => {
    for (const m of mats) m.transparent = true;
    ghostables.push({ normal, materials: mats, lines, minOpacity, amount: 0 });
  };

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = group, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Shared (never faded) materials.
  const mats = {
    plinth: std(P.plinth, 0.96, 0, { map: concrete }),
    concrete: std(P.wall, 0.94, 0, { map: concrete }),
    roof: std(P.roof, 0.66, 0.08),
    ridge: std(P.ridge, 0.66, 0.08),
    trim: std(P.trim, 0.7),
    metal: std(P.metal, 0.5, 0.35),
    gutter: std(P.gutter, 0.48, 0.35, { side: THREE.DoubleSide }),
    cap: std(P.cap, 0.9),
    deck: std(P.deck, 0.88),
    deckSide: std(P.deckSide, 0.95),
    tubShell: std(P.tubShell, 0.6),
    tubInner: std(P.tubShell, 0.6, 0, { side: THREE.BackSide }),
    water: std(P.water, 0.12, 0, { emissive: new THREE.Color(P.water), emissiveIntensity: 0.18 }),
  };

  /** Materials of one wall side. In cut-away mode each side owns its materials so it can fade. */
  const shared: Record<string, THREE.MeshStandardMaterial> = {};
  const sideMaterials = () => {
    const make = (key: string, f: () => THREE.MeshStandardMaterial) => (cutaway ? f() : (shared[key] ??= f()));
    return {
      wall: make("wall", () => std(P.wall, 0.94, 0, { map: concrete })),
      plinth: make("plinth", () => std(P.plinth, 0.96, 0, { map: concrete })),
      trim: make("trim", () => std(P.trim, 0.7)),
      glass: make("glass", () => std("#ffffff", 0.3, 0, { map: glassTex, side: THREE.DoubleSide })),
      frosted: make("frosted", () => std(P.frosted, 0.85, 0, { side: THREE.DoubleSide })),
      door: make("door", () => std(P.door, 0.75)),
      dark: make("dark", () => std(P.metal, 0.6, 0.2)),
      cabinet: make("cabinet", () => std(P.gutter, 0.55, 0.3)),
    };
  };

  // ---------------------------------------------------------------- walls, openings, plinth
  for (const side of SIDES) {
    const sideGroup = new THREE.Group();
    sideGroup.name = `side-${side}`;
    group.add(sideGroup);
    const M = sideMaterials();
    const matrix = sideMatrix(side);
    const openings = OPENINGS[side];

    // Wall with holes, extruded inwards from the outer face (local z = 0).
    const shape = new THREE.Shape(wallOutline(side).map(([u, y]) => new THREE.Vector2(u, y)));
    for (const o of openings) {
      const u0 = o.u - o.w / 2;
      const u1 = o.u + o.w / 2;
      shape.holes.push(
        new THREE.Path([
          new THREE.Vector2(u0, o.y),
          new THREE.Vector2(u0, o.y + o.h),
          new THREE.Vector2(u1, o.y + o.h),
          new THREE.Vector2(u1, o.y),
        ]),
      );
    }
    const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: H.wallT, bevelEnabled: false, curveSegments: 1 });
    wallGeo.translate(0, 0, -H.wallT);
    wallGeo.applyMatrix4(matrix);
    mesh(wallGeo, M.wall, sideGroup, !cutaway);

    // Frames, glass, sills and doors, built in the wall's local frame.
    const R = 0.07; // recess of the frame from the wall face
    const FD = 0.075; // frame depth
    const FW = 0.06; // frame member width
    const frames: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    const frosted: THREE.BufferGeometry[] = [];
    const doors: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    for (const o of openings) {
      const u0 = o.u - o.w / 2;
      const u1 = o.u + o.w / 2;
      const y0 = o.y;
      const y1 = o.y + o.h;
      const zb = -R - FD;
      const zf = -R;
      frames.push(boxG(u0, u0 + FW, y0, y1, zb, zf), boxG(u1 - FW, u1, y0, y1, zb, zf), boxG(u0, u1, y1 - FW, y1, zb, zf));
      if (o.kind !== "door") frames.push(boxG(u0, u1, y0, y0 + FW, zb, zf));
      if (o.kind === "window" || o.kind === "frosted") {
        // Sill board proud of the wall, casting a crisp shadow line.
        frames.push(boxG(u0 - 0.05, u1 + 0.05, y0 - 0.05, y0, zf, 0.06));
      }
      if (o.kind === "door") {
        doors.push(boxG(u0 + FW, u1 - FW, y0, y1 - FW, zb + 0.015, zf - 0.02));
        // Narrow glazed strip and a handle.
        glass.push(boxG(u0 + FW + 0.12, u0 + FW + 0.26, y0 + 0.45, y1 - FW - 0.2, zf - 0.025, zf - 0.015));
        dark.push(boxG(u1 - FW - 0.16, u1 - FW - 0.1, y0 + 0.95, y0 + 1.15, zf - 0.02, zf + 0.02));
        continue;
      }
      if (o.kind === "vent") {
        dark.push(boxG(u0 + FW, u1 - FW, y0 + FW, y1 - FW, zb, zb + 0.01));
        for (let i = 1; i <= 3; i++) {
          const y = y0 + FW + ((o.h - 2 * FW) * i) / 4;
          frames.push(boxG(u0 + FW, u1 - FW, y - 0.025, y + 0.025, zb + 0.01, zf - 0.01));
        }
        continue;
      }
      const panes = o.kind === "glassDoor" ? 2 : o.w >= 1.8 ? 3 : o.w >= 1.25 ? 2 : 1;
      const paneW = (o.w - FW * 2) / panes;
      for (let i = 0; i < panes; i++) {
        const pu0 = u0 + FW + i * paneW;
        if (i > 0) frames.push(boxG(pu0 - FW * 0.4, pu0 + FW * 0.4, y0, y1, zb, zf));
        const pane = new THREE.PlaneGeometry(paneW, o.h - FW * 2);
        pane.translate(pu0 + paneW / 2, y0 + o.h / 2, zb + FD * 0.45);
        (o.kind === "frosted" ? frosted : glass).push(pane);
      }
    }
    const addLocal = (list: THREE.BufferGeometry[], mat: THREE.Material, shadow = true) => {
      if (!list.length) return;
      const g = merge(list);
      g.applyMatrix4(matrix);
      mesh(g, mat, sideGroup, shadow && !cutaway);
    };
    addLocal(frames, M.trim);
    addLocal(glass, M.glass, false);
    addLocal(frosted, M.frosted, false);
    addLocal(doors, M.door);
    addLocal(dark, M.dark);

    // Plinth band, slightly proud of the wall face.
    const out = H.plinthOut;
    const inner = H.wallT;
    const plinthGeo =
      side === "front"
        ? boxG(-H.halfW - out, H.halfW + out, 0, H.plinthTop, H.halfD - inner, H.halfD + out)
        : side === "back"
          ? boxG(-H.halfW - out, H.halfW + out, 0, H.plinthTop, -H.halfD - out, -H.halfD + inner)
          : side === "right"
            ? boxG(H.halfW - inner, H.halfW + out, 0, H.plinthTop, -H.halfD + inner, H.halfD - inner)
            : boxG(-H.halfW - out, -H.halfW + inner, 0, H.plinthTop, -H.halfD + inner, H.halfD - inner);
    mesh(plinthGeo, M.plinth, sideGroup, !cutaway);

    // Utility cabinet (district-heating and electricity intake) under the first front window.
    if (side === "front") mesh(boxG(-4.06, -3.5, 0.68, 1.22, H.halfD, H.halfD + 0.12), M.cabinet, sideGroup, !cutaway);

    if (cutaway) {
      const lines = new THREE.LineBasicMaterial({ color: "#8d999b", transparent: true, opacity: 0, depthWrite: false });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(wallGeo, 25), lines);
      edges.renderOrder = 2;
      sideGroup.add(edges);
      const plinthEdges = new THREE.LineSegments(new THREE.EdgesGeometry(plinthGeo, 25), lines);
      plinthEdges.renderOrder = 2;
      sideGroup.add(plinthEdges);
      addGhostable(new THREE.Vector3(...SIDE_FRAME[side].n), [M.wall, M.plinth, M.trim, M.glass, M.frosted, M.door, M.dark, M.cabinet], lines, 0.1);
    }
  }

  // ---------------------------------------------------------------- roof
  for (const sgn of [1, -1] as const) {
    const slopeGroup = new THREE.Group();
    slopeGroup.name = sgn > 0 ? "roof-front" : "roof-back";
    group.add(slopeGroup);
    const roofMat = cutaway ? std(P.roof, 0.66, 0.08) : mats.roof;
    const slabMat = cutaway ? std(P.trim, 0.7) : mats.trim;
    const n = new THREE.Vector3(0, COS_PITCH, sgn * SIN_PITCH);
    const s = new THREE.Vector3(0, -SIN_PITCH, sgn * COS_PITCH);

    // Corrugated sheet: a sine profile across the slope, ridges running down to the eave.
    const L = ROOF_HALF_LEN * 2 + 0.04;
    const waves = Math.round(L / 0.22);
    const perWave = 8;
    const nu = waves * perWave;
    const k = (Math.PI * 2 * waves) / L;
    const amp = 0.028;
    const lift = 0.04;
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const tmp = new THREE.Vector3();
    for (let i = 0; i <= nu; i++) {
      const u = -L / 2 + (L * i) / nu;
      const h = lift + amp * Math.sin(k * (u + L / 2));
      const dh = amp * k * Math.cos(k * (u + L / 2));
      tmp.copy(n).addScaledVector(new THREE.Vector3(1, 0, 0), -dh).normalize();
      // The sheet runs a little past the fascia, so its wavy edge shows at the eave.
      for (const v of [-0.02, SLOPE_LEN + 0.07]) {
        pos.push(u, RIDGE_TOP + s.y * v + n.y * h, s.z * v + n.z * h);
        nor.push(tmp.x, tmp.y, tmp.z);
        uv.push(i / nu, v / SLOPE_LEN);
      }
    }
    for (let i = 0; i < nu; i++) {
      const a = i * 2;
      const b = a + 2;
      const c = a + 1;
      const d = a + 3;
      if (sgn > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
    const sheet = new THREE.BufferGeometry();
    sheet.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    sheet.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    sheet.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    sheet.setIndex(idx);
    // The slab below casts the roof's shadow; a self-shadowing corrugated sheet only shows acne.
    mesh(sheet, roofMat, slopeGroup, false);

    // Slab under the sheet (its underside is the white soffit of the overhang).
    const mid = new THREE.Vector3(0, RIDGE_TOP, 0).addScaledVector(s, SLOPE_LEN / 2);
    const slab = new THREE.BoxGeometry(ROOF_HALF_LEN * 2, H.roofSlab, SLOPE_LEN);
    slab.rotateX(sgn * Math.asin(SIN_PITCH));
    slab.translate(mid.x - n.x * (H.roofSlab / 2), mid.y - n.y * (H.roofSlab / 2), mid.z - n.z * (H.roofSlab / 2));
    const slabMesh = mesh(slab, slabMat, slopeGroup, !cutaway);

    // White bargeboards along the gable edges and a fascia board at the eave.
    const trims: THREE.BufferGeometry[] = [];
    for (const end of [-1, 1]) {
      const b = new THREE.BoxGeometry(0.05, 0.27, SLOPE_LEN + 0.05);
      b.rotateX(sgn * Math.asin(SIN_PITCH));
      const c = mid.clone().addScaledVector(n, -0.06);
      b.translate(end * (ROOF_HALF_LEN + 0.025), c.y, c.z);
      trims.push(b);
    }
    trims.push(boxG(-ROOF_HALF_LEN - 0.05, ROOF_HALF_LEN + 0.05, EAVE_TOP_Y - 0.22, EAVE_TOP_Y, sgn * EAVE_Z, sgn * (EAVE_Z + 0.05)));
    const trimMesh = mesh(merge(trims), slabMat, slopeGroup, !cutaway);

    // Half-round gutter under the fascia.
    const gr = 0.085;
    const gutter = new THREE.CylinderGeometry(gr, gr, ROOF_HALF_LEN * 2 + 0.1, 12, 1, true, 0, Math.PI);
    gutter.rotateZ(-Math.PI / 2);
    gutter.translate(0, EAVE_TOP_Y - 0.17, sgn * (EAVE_Z + 0.05 + gr));
    mesh(gutter, mats.gutter, group);

    // Downpipes at both corners: drop, swan neck back to the wall, down to a shoe at the ground.
    const pipes: THREE.BufferGeometry[] = [];
    const gz = sgn * (EAVE_Z + 0.05 + gr);
    const wz = sgn * (H.halfD + 0.075);
    const gy = EAVE_TOP_Y - 0.2;
    for (const x of [-(H.halfW - 0.2), H.halfW - 0.2]) {
      const collar = (y: number, z: number) => pipeG([x, y - 0.035, z], [x, y + 0.035, z], 0.056);
      pipes.push(
        pipeG([x, gy, gz], [x, gy - 0.3, gz], 0.045),
        pipeG([x, gy - 0.3, gz], [x, gy - 0.62, wz], 0.045),
        pipeG([x, gy - 0.62, wz], [x, 0.3, wz], 0.045),
        pipeG([x, 0.3, wz], [x, 0.1, wz + sgn * 0.2], 0.045),
        collar(gy - 0.3, gz),
        collar(gy - 0.62, wz),
        collar(0.3, wz),
        collar(2.6, wz),
      );
    }
    mesh(merge(pipes), mats.gutter, group);

    if (cutaway) {
      const lines = new THREE.LineBasicMaterial({ color: "#8d999b", transparent: true, opacity: 0, depthWrite: false });
      for (const geo of [slabMesh.geometry, trimMesh.geometry]) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), lines);
        e.renderOrder = 2;
        slopeGroup.add(e);
      }
      // The roof stays readable as a surface, so its hotspot still sits on something.
      addGhostable(n.clone(), [roofMat, slabMat], lines, 0.34);
    }
  }

  // Ridge cap (mænir).
  const ridge = new THREE.BoxGeometry(ROOF_HALF_LEN * 2 + 0.08, 0.17, 0.17);
  ridge.rotateX(Math.PI / 4);
  ridge.translate(0, RIDGE_TOP + 0.05, 0);
  mesh(ridge, mats.ridge);

  // ---------------------------------------------------------------- chimney
  {
    const s = CHIMNEY.size / 2;
    const base = roofTopY(CHIMNEY.z + s) - 0.4;
    mesh(boxG(CHIMNEY.x - s, CHIMNEY.x + s, base, CHIMNEY.top, CHIMNEY.z - s, CHIMNEY.z + s), mats.concrete);
    mesh(
      merge([
        boxG(CHIMNEY.x - s - 0.07, CHIMNEY.x + s + 0.07, CHIMNEY.top, CHIMNEY.top + 0.09, CHIMNEY.z - s - 0.07, CHIMNEY.z + s + 0.07),
        pipeG([CHIMNEY.x, CHIMNEY.top + 0.09, CHIMNEY.z], [CHIMNEY.x, CHIMNEY.top + 0.32, CHIMNEY.z], 0.09, 12),
      ]),
      mats.cap,
    );
  }

  // ---------------------------------------------------------------- balcony, entrance
  {
    const zf = H.halfD + BALCONY.depth;
    mesh(boxG(BALCONY.x0, BALCONY.x1, BALCONY.top - BALCONY.thick, BALCONY.top, H.halfD, zf), mats.concrete);
    const rail: THREE.BufferGeometry[] = [];
    const yTop = BALCONY.top + BALCONY.rail;
    const yBot = BALCONY.top + 0.08;
    const t = 0.045;
    const zr = zf - 0.04;
    rail.push(
      boxG(BALCONY.x0 + 0.02, BALCONY.x1 - 0.02, yTop - t, yTop, zr - t, zr),
      boxG(BALCONY.x0 + 0.02, BALCONY.x1 - 0.02, yBot, yBot + 0.03, zr - 0.03, zr),
    );
    for (const x of [BALCONY.x0 + 0.02, BALCONY.x1 - 0.02 - t]) {
      rail.push(boxG(x, x + t, yTop - t, yTop, H.halfD, zr), boxG(x, x + 0.03, yBot, yBot + 0.03, H.halfD, zr));
      rail.push(boxG(x, x + t, BALCONY.top, yTop, zr - t, zr));
    }
    for (let x = BALCONY.x0 + 0.14; x < BALCONY.x1 - 0.1; x += 0.115) rail.push(boxG(x, x + 0.02, yBot, yTop - t, zr - 0.03, zr - 0.01));
    for (const x of [BALCONY.x0 + 0.03, BALCONY.x1 - 0.05]) {
      for (let z = H.halfD + 0.12; z < zr - 0.08; z += 0.115) rail.push(boxG(x, x + 0.02, yBot, yTop - t, z, z + 0.02));
    }
    mesh(merge(rail), mats.metal);

    // Canopy over the front door and concrete steps.
    const ex = ENTRANCE.x;
    mesh(boxG(ex - 0.85, ex + 0.85, 3.0, 3.11, H.halfD, H.halfD + 0.95), mats.concrete);
    mesh(
      merge([
        boxG(ex - 0.78, ex + 0.78, 0, H.plinthTop, H.halfD + H.plinthOut, H.halfD + 1.05),
        boxG(ex - 0.78, ex + 0.78, 0, 0.4, H.halfD + 1.05, H.halfD + 1.36),
        boxG(ex - 0.78, ex + 0.78, 0, 0.2, H.halfD + 1.36, H.halfD + 1.67),
      ]),
      mats.plinth,
    );
  }

  // ---------------------------------------------------------------- deck and hot tub
  {
    const boards: THREE.BufferGeometry[] = [];
    for (let x = DECK.x0 + 0.01; x + 0.14 <= DECK.x1; x += 0.16) boards.push(boxG(x, x + 0.14, DECK.top - 0.055, DECK.top, DECK.z0, DECK.z1));
    mesh(merge(boards), mats.deck);
    mesh(
      merge([
        boxG(DECK.x0, DECK.x1 - 0.04, 0, DECK.top - 0.055, DECK.z0 + 0.04, DECK.z1 - 0.04),
        boxG(6.0, 7.7, 0, 0.21, DECK.z1, DECK.z1 + 0.34),
      ]),
      mats.deckSide,
    );
    const shellH = TUB.rim - (DECK.top - 0.06);
    const shell = new THREE.CylinderGeometry(TUB.r, TUB.r, shellH, 48, 1, true);
    shell.translate(TUB.x, DECK.top - 0.06 + shellH / 2, TUB.z);
    mesh(shell, mats.tubShell);
    const rim = new THREE.TorusGeometry(TUB.r - 0.035, 0.055, 8, 48);
    rim.rotateX(Math.PI / 2);
    rim.translate(TUB.x, TUB.rim, TUB.z);
    mesh(rim, mats.tubShell);
    const inner = new THREE.CylinderGeometry(TUB.r - 0.09, TUB.r - 0.09, TUB.rim - TUB.water + 0.02, 48, 1, true);
    inner.translate(TUB.x, (TUB.rim + TUB.water) / 2, TUB.z);
    mesh(inner, mats.tubInner, group, false);
    const water = new THREE.CircleGeometry(TUB.r - 0.09, 48);
    water.rotateX(-Math.PI / 2);
    water.translate(TUB.x, TUB.water, TUB.z);
    mesh(water, mats.water, group, false);
  }

  if (interior) buildInterior(group, std, mesh);

  return { group, ghostables, materials };
}

// ------------------------------------------------------------------ cut-away interior

type StdFn = (color: string, roughness?: number, metalness?: number, extra?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
type MeshFn = (geo: THREE.BufferGeometry, mat: THREE.Material, parent?: THREE.Object3D, shadow?: boolean) => THREE.Mesh;

function buildInterior(group: THREE.Group, std: StdFn, mesh: MeshFn) {
  const C = INTERIOR_COLORS;
  const I = INTERIOR;
  const xi = H.halfW - H.wallT;
  const zi = H.halfD - H.wallT;
  const inner = new THREE.Group();
  inner.name = "interior";
  group.add(inner);
  const add = (list: THREE.BufferGeometry[], mat: THREE.Material) => mesh(merge(list), mat, inner);

  // Floors: ground-floor slab and the upper floor with a stairwell. No ceiling, so the upper
  // floor stays visible through the faded roof.
  add([boxG(-xi, xi, I.gfSlab[0], I.gfSlab[1], -zi, zi)], std(C.floor, 0.85));
  add(
    [
      boxG(-xi, xi, I.ufSlab[0], I.ufSlab[1], -2.2, zi),
      boxG(-xi, -1.3, I.ufSlab[0], I.ufSlab[1], -zi, -2.2),
      boxG(1.7, xi, I.ufSlab[0], I.ufSlab[1], -zi, -2.2),
    ],
    std(C.floor, 0.85),
  );

  // Low partition walls, cut like a plan section so they never block the view.
  const px = I.partitionX;
  const ph = I.partitionH;
  const g0 = H.plinthTop;
  const g1 = H.floor2;
  add(
    [
      boxG(px - 0.06, px + 0.06, g0, g0 + ph, -zi, 1.2),
      boxG(px - 0.06, px + 0.06, g0, g0 + ph, 2.1, zi),
      boxG(px + 0.06, 2.1, g0, g0 + ph, -1.06, -0.94),
      boxG(2.9, xi, g0, g0 + ph, -1.06, -0.94),
      boxG(px - 0.06, px + 0.06, g1, g1 + ph, -zi, -0.6),
      boxG(px - 0.06, px + 0.06, g1, g1 + ph, 0.3, zi),
      boxG(px + 0.06, 2.1, g1, g1 + ph, -1.06, -0.94),
      boxG(2.9, xi, g1, g1 + ph, -1.06, -0.94),
    ],
    std(C.partition, 0.9),
  );

  const fixture = std(C.fixture, 0.6);
  const dark = std(C.dark, 0.55, 0.2);
  const copper = std(C.copper, 0.45, 0.6);
  const pipe = std(C.pipe, 0.5, 0.2);

  // Kitchen run with a worktop and sink.
  const k = I.counter;
  add([boxG(k.x0, k.x1, g0, k.top - 0.04, k.z0, k.z1)], fixture);
  add([boxG(k.x0 - 0.02, k.x1 + 0.02, k.top - 0.04, k.top, k.z0, k.z1 + 0.03)], std(C.counterTop, 0.6));
  add([boxG(-3.35, -2.75, k.top, k.top + 0.006, -3.12, -2.78)], dark);

  // Fireplace on the left wall.
  const f = I.fireplace;
  add([boxG(-xi, -xi + 0.45, g0, f.top, f.z0, f.z1)], std("#cfccc6", 0.95));
  add([boxG(-xi + 0.45, -xi + 0.46, g0 + 0.15, g0 + 0.72, f.z0 + 0.3, f.z1 - 0.3)], dark);

  // Straight stair along the back wall, with a handrail on the open side.
  const st = I.stairs;
  const run = (st.xBottom - st.xTop) / st.steps;
  const rise = (g1 - g0) / st.steps;
  const steps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < st.steps; i++) {
    const top = g0 + (i + 1) * rise;
    steps.push(boxG(st.xBottom - (i + 1) * run, st.xBottom - i * run, Math.max(g0, top - 0.36), top, st.z0, st.z1));
  }
  add(steps, std(C.partition, 0.85));
  add(
    [
      pipeG([st.xBottom, g0 + 0.95, st.z1 + 0.02], [st.xTop, g1 + 0.95, st.z1 + 0.02], 0.022),
      pipeG([st.xBottom - 0.05, g0 + rise, st.z1 + 0.02], [st.xBottom - 0.05, g0 + 0.95, st.z1 + 0.02], 0.02),
      pipeG([st.xTop + 0.05, g1, st.z1 + 0.02], [st.xTop + 0.05, g1 + 0.95, st.z1 + 0.02], 0.02),
    ],
    dark,
  );

  // Bathroom upstairs: bath and WC.
  const t = I.tub;
  add(
    [
      boxG(t.x0, t.x1, g1, t.top, t.z0, t.z1),
      boxG(2.15, 2.55, g1, g1 + 0.42, -zi, -2.85),
      boxG(2.15, 2.55, g1 + 0.42, g1 + 0.85, -zi, -3.08),
    ],
    fixture,
  );
  add([boxG(t.x0 + 0.08, t.x1 - 0.08, t.top, t.top + 0.004, t.z0 + 0.08, t.z1 - 0.08)], std(C.basin, 0.4));

  // Laundry and plant room: washer, hot-water tank, district-heating manifold, risers, soil stack.
  const w = I.washer;
  add([boxG(w.x0, w.x1, g0, w.top, w.z0, w.z1)], fixture);
  const door = new THREE.CircleGeometry(0.19, 24);
  door.translate((w.x0 + w.x1) / 2, g0 + 0.45, w.z1 + 0.004);
  add([door], dark);
  const tk = I.tank;
  const tank = new THREE.CylinderGeometry(tk.r, tk.r, tk.top - g0, 24);
  tank.translate(tk.x, (tk.top + g0) / 2, tk.z);
  add([tank], fixture);
  const m = I.manifold;
  add([boxG(m.x0, m.x1, m.y0, m.y1, -zi, -zi + 0.03)], std(C.board, 0.9));
  const manifold: THREE.BufferGeometry[] = [];
  for (const y of [1.18, 1.38, 1.58]) manifold.push(pipeG([m.x0 + 0.05, y, -zi + 0.07], [m.x1 - 0.05, y, -zi + 0.07], 0.024));
  for (const x of I.pipesX) manifold.push(pipeG([x, I.gfSlab[0], -zi + 0.07], [x, I.ceiling[0], -zi + 0.07], 0.022));
  add(manifold, copper);
  const gauges: THREE.BufferGeometry[] = [];
  for (const x of [2.2, 2.52]) {
    const gg = new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16);
    gg.rotateX(Math.PI / 2);
    gg.translate(x, 1.66, -zi + 0.08);
    gauges.push(gg);
  }
  add(gauges, std("#f2f2ef", 0.5));
  const ss = I.soilStack;
  add([pipeG([ss.x, -0.05, ss.z], [ss.x, I.ceiling[0], ss.z], 0.06, 12), pipeG([ss.x, 0.2, ss.z], [ss.x, 0.2, -H.halfD - 0.2], 0.06, 12)], pipe);

  // Electrical panel, radiator, smoke alarm and extract fan.
  const p = I.panel;
  add([boxG(-xi, -xi + 0.11, p.y0, p.y1, p.z0, p.z1)], std("#e8ebeb", 0.6));
  add([boxG(-xi + 0.11, -xi + 0.115, p.y0 + 0.12, p.y1 - 0.12, p.z0 + 0.08, p.z1 - 0.08)], dark);
  const r = I.radiator;
  const fins: THREE.BufferGeometry[] = [];
  for (let z = r.z0; z + 0.05 <= r.z1; z += 0.09) fins.push(boxG(-xi, -xi + 0.1, r.y0, r.y1, z, z + 0.05));
  add(fins, fixture);
  const smoke = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16);
  smoke.rotateX(Math.PI / 2);
  smoke.translate(I.smoke[0], I.smoke[1], -zi + 0.03);
  add([smoke, boxG(I.fan[0] - 0.14, I.fan[0] + 0.14, I.fan[1] - 0.14, I.fan[1] + 0.14, -zi, -zi + 0.03)], std("#f4f4f2", 0.6));

  // A little furniture so the rooms read: sofa, dining table, bed.
  const soft = std("#d9dedc", 0.95);
  add(
    [
      boxG(-4.3, -2.5, g0, g0 + 0.42, 2.25, 3.05),
      boxG(-4.3, -2.5, g0 + 0.42, g0 + 0.8, 2.85, 3.05),
      boxG(2.45, 4.35, g1, g1 + 0.45, 0.55, 2.7),
      boxG(2.45, 4.35, g1 + 0.45, g1 + 0.95, 0.55, 0.7),
    ],
    soft,
  );
  add(
    [
      boxG(2.6, 4.0, g0 + 0.72, g0 + 0.76, 0.5, 1.5),
      boxG(2.65, 2.7, g0, g0 + 0.72, 0.55, 0.6),
      boxG(3.9, 3.95, g0, g0 + 0.72, 0.55, 0.6),
      boxG(2.65, 2.7, g0, g0 + 0.72, 1.4, 1.45),
      boxG(3.9, 3.95, g0, g0 + 0.72, 1.4, 1.45),
    ],
    std("#c9b79c", 0.8),
  );
}

/** Disposes every geometry, material and texture under `root`. */
export function disposeObject(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => materials.add(x));
    if ((o as THREE.Light).isLight) (o as THREE.Light).dispose();
  });
  for (const mat of materials) {
    for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
    mat.dispose();
  }
  textures.forEach((t) => t.dispose());
}
