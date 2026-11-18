/**
 * Static SVG drawing of the same house from the same three-quarter view as the 3D scenes.
 * Shown while three.js loads, when WebGL is unavailable, and in print. No three.js import.
 */
import { useId } from "react";
import {
  BALCONY,
  CHIMNEY,
  DECK,
  EAVE_TOP_Y,
  EAVE_Z,
  ENTRANCE,
  FRAME_POINTS,
  H,
  OPENINGS,
  RIDGE_TOP,
  ROOF_HALF_LEN,
  TUB,
  VIEW,
  makeProjector,
  onWall,
  roofUnderY,
  type Side,
  type Vec3,
} from "./houseSpec";

const project = makeProjector(VIEW.azimuth, VIEW.elevation);
const S = 40; // viewBox units per metre

const xy = (p: Vec3): [number, number] => {
  const [x, y] = project(p);
  return [x * S, y * S];
};
const pts = (ps: Vec3[]) =>
  ps
    .map(xy)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
const seg = (a: Vec3, b: Vec3) => {
  const [x1, y1] = xy(a);
  const [x2, y2] = xy(b);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
};
const circle = (cx: number, y: number, cz: number, r: number, n = 40): Vec3[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r] as Vec3;
  });

/** Visible faces of a box from the front-right: top, front (+z) and right (+x). */
function boxFaces(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return {
    top: pts([
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ]),
    front: pts([
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ]),
    right: pts([
      [x1, y0, z1],
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
    ]),
  };
}

const COLORS = {
  hero: { front: "#efece6", right: "#d8d3cb", plinthF: "#bcb6ac", plinthR: "#a8a299", roof: "#a1382c", roofLine: "#842c22", glass: "#2e3d46" },
  map: { front: "#f2f4f2", right: "#dfe3e1", plinthF: "#cbcdc9", plinthR: "#b9bcb8", roof: "#5d676f", roofLine: "#4a535a", glass: "#566770" },
} as const;

function openingShapes(side: Side) {
  const out: { frame: string; glass: string[]; kind: string; sill?: string; mullions: string[] }[] = [];
  for (const o of OPENINGS[side]) {
    const u0 = o.u - o.w / 2;
    const u1 = o.u + o.w / 2;
    const y1 = o.y + o.h;
    const f = 0.07;
    const frame = pts([onWall(side, u0, o.y, 0.01), onWall(side, u1, o.y, 0.01), onWall(side, u1, y1, 0.01), onWall(side, u0, y1, 0.01)]);
    const glass = [
      pts([
        onWall(side, u0 + f, o.y + f, 0.02),
        onWall(side, u1 - f, o.y + f, 0.02),
        onWall(side, u1 - f, y1 - f, 0.02),
        onWall(side, u0 + f, y1 - f, 0.02),
      ]),
    ];
    const panes = o.kind === "glassDoor" ? 2 : o.w >= 1.8 ? 3 : o.w >= 1.25 ? 2 : 1;
    const mullions: string[] = [];
    for (let i = 1; i < panes; i++) {
      const u = u0 + (o.w * i) / panes;
      mullions.push(seg(onWall(side, u, o.y, 0.03), onWall(side, u, y1, 0.03)));
    }
    const sill =
      o.kind === "window" || o.kind === "frosted"
        ? seg(onWall(side, u0 - 0.05, o.y - 0.02, 0.06), onWall(side, u1 + 0.05, o.y - 0.02, 0.06))
        : undefined;
    out.push({ frame, glass, kind: o.kind, sill, mullions });
  }
  return out;
}

// Geometry is fixed, so it is computed once.
const G = (() => {
  const hw = H.halfW;
  const hd = H.halfD;
  const groundC = (-hw + DECK.x1) / 2;
  const ground = pts(circle(groundC, 0, 0.6, 10.5, 64));
  const footprint = pts([
    [-hw, 0, -hd],
    [hw, 0, -hd],
    [DECK.x1, 0, DECK.z0],
    [DECK.x1, 0, DECK.z1],
    [hw, 0, hd + 0.3],
    [-hw, 0, hd + 0.3],
  ]);
  const frontWall = pts([
    [-hw, H.wallBase, hd],
    [hw, H.wallBase, hd],
    [hw, H.eave, hd],
    [-hw, H.eave, hd],
  ]);
  const rightWall = pts([
    [hw, H.wallBase, hd],
    [hw, H.wallBase, -hd],
    [hw, H.eave, -hd],
    [hw, roofUnderY(0), 0],
    [hw, H.eave, hd],
  ]);
  const o = H.plinthOut;
  const plinthFront = pts([
    [-hw - o, 0, hd + o],
    [hw + o, 0, hd + o],
    [hw + o, H.plinthTop, hd + o],
    [-hw - o, H.plinthTop, hd + o],
  ]);
  const plinthRight = pts([
    [hw + o, 0, hd + o],
    [hw + o, 0, -hd - o],
    [hw + o, H.plinthTop, -hd - o],
    [hw + o, H.plinthTop, hd + o],
  ]);
  const L = ROOF_HALF_LEN;
  const roof = pts([
    [-L, EAVE_TOP_Y + 0.05, EAVE_Z + 0.04],
    [L, EAVE_TOP_Y + 0.05, EAVE_Z + 0.04],
    [L, RIDGE_TOP + 0.07, 0],
    [-L, RIDGE_TOP + 0.07, 0],
  ]);
  let ribs = "";
  for (let x = -L + 0.1; x < L; x += 0.22) ribs += seg([x, RIDGE_TOP + 0.07, 0], [x, EAVE_TOP_Y + 0.05, EAVE_Z + 0.04]);
  const fascia = pts([
    [-L - 0.05, EAVE_TOP_Y - 0.22, EAVE_Z + 0.05],
    [L + 0.05, EAVE_TOP_Y - 0.22, EAVE_Z + 0.05],
    [L + 0.05, EAVE_TOP_Y, EAVE_Z + 0.05],
    [-L - 0.05, EAVE_TOP_Y, EAVE_Z + 0.05],
  ]);
  const gutter = seg([-L - 0.05, EAVE_TOP_Y - 0.24, EAVE_Z + 0.14], [L + 0.05, EAVE_TOP_Y - 0.24, EAVE_Z + 0.14]);
  const barge = pts([
    [L + 0.03, EAVE_TOP_Y - 0.1, EAVE_Z],
    [L + 0.03, RIDGE_TOP - 0.02, 0],
    [L + 0.03, EAVE_TOP_Y - 0.1, -EAVE_Z],
  ]);
  const ridge = seg([-L - 0.04, RIDGE_TOP + 0.12, 0], [L + 0.04, RIDGE_TOP + 0.12, 0]);
  const cs = CHIMNEY.size / 2;
  const chimney = boxFaces(CHIMNEY.x - cs, CHIMNEY.x + cs, RIDGE_TOP - 0.6, CHIMNEY.top, CHIMNEY.z - cs, CHIMNEY.z + cs);
  const chimneyCap = boxFaces(CHIMNEY.x - cs - 0.07, CHIMNEY.x + cs + 0.07, CHIMNEY.top, CHIMNEY.top + 0.09, CHIMNEY.z - cs - 0.07, CHIMNEY.z + cs + 0.07);
  const downpipes = [-(hw - 0.2), hw - 0.2].map((x) => seg([x, EAVE_TOP_Y - 0.3, hd + 0.08], [x, 0.12, hd + 0.08])).join("");

  const bz = hd + BALCONY.depth;
  const balcony = boxFaces(BALCONY.x0, BALCONY.x1, BALCONY.top - BALCONY.thick, BALCONY.top, hd, bz);
  const yTop = BALCONY.top + BALCONY.rail;
  let rail = seg([BALCONY.x0, yTop, bz], [BALCONY.x1, yTop, bz]) + seg([BALCONY.x1, yTop, bz], [BALCONY.x1, yTop, hd]);
  rail += seg([BALCONY.x0, yTop, bz], [BALCONY.x0, yTop, hd]);
  let bars = "";
  for (let x = BALCONY.x0 + 0.05; x <= BALCONY.x1; x += 0.115) bars += seg([x, BALCONY.top, bz], [x, yTop, bz]);
  for (let z = hd + 0.1; z <= bz; z += 0.115) bars += seg([BALCONY.x1, BALCONY.top, z], [BALCONY.x1, yTop, z]);

  const cabinet = boxFaces(-4.06, -3.5, 0.68, 1.22, hd, hd + 0.12);
  const ex = ENTRANCE.x;
  const canopy = boxFaces(ex - 0.85, ex + 0.85, 3.0, 3.11, hd, hd + 0.95);
  const steps = [
    boxFaces(ex - 0.78, ex + 0.78, 0, H.plinthTop, hd + o, hd + 1.05),
    boxFaces(ex - 0.78, ex + 0.78, 0, 0.4, hd + 1.05, hd + 1.36),
    boxFaces(ex - 0.78, ex + 0.78, 0, 0.2, hd + 1.36, hd + 1.67),
  ];

  const deck = boxFaces(DECK.x0, DECK.x1, 0, DECK.top, DECK.z0, DECK.z1);
  let boards = "";
  for (let x = DECK.x0 + 0.16; x < DECK.x1; x += 0.16) boards += seg([x, DECK.top, DECK.z0], [x, DECK.top, DECK.z1]);
  const tubBase = pts(circle(TUB.x, DECK.top, TUB.z, TUB.r));
  const tubRim = pts(circle(TUB.x, TUB.rim, TUB.z, TUB.r + 0.03));
  const water = pts(circle(TUB.x, TUB.water + 0.02, TUB.z, TUB.r - 0.1));

  // View boxes framed like the 3D cameras (same extreme points, similar margins), so the
  // drawing and the canvas line up when one fades into the other.
  const p2 = FRAME_POINTS.map(xy);
  const minX = Math.min(...p2.map((p) => p[0]));
  const maxX = Math.max(...p2.map((p) => p[0]));
  const minY = Math.min(...p2.map((p) => p[1]));
  const maxY = Math.max(...p2.map((p) => p[1]));
  const box = (padX: number, padY: number) => {
    const w = (maxX - minX) / (1 - 2 * padX);
    const h = (maxY - minY) / (1 - 2 * padY);
    return `${((minX + maxX) / 2 - w / 2).toFixed(0)} ${((minY + maxY) / 2 - h / 2).toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`;
  };
  const viewBox = { hero: box(0.12, 0.06), map: box(0.04, 0.06) };

  return {
    ground,
    footprint,
    frontWall,
    rightWall,
    plinthFront,
    plinthRight,
    roof,
    ribs,
    fascia,
    gutter,
    barge,
    ridge,
    chimney,
    chimneyCap,
    downpipes,
    balcony,
    rail,
    bars,
    canopy,
    cabinet,
    steps,
    deck,
    boards,
    tubBase,
    tubRim,
    water,
    front: openingShapes("front"),
    right: openingShapes("right"),
    viewBox,
  };
})();

/** Projects pins and nudges overlapping ones apart (more serious pins move less). */
function spread(pins: StaticPin[]) {
  const nodes = pins.map((p) => {
    const [x, y] = xy(p.at);
    return { p, x, y, r: (p.size / 2) * 0.62, w: p.size };
  });
  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r + 5;
        if (d >= min) continue;
        if (d < 0.01) {
          dx = 1;
          dy = 0.3;
          d = Math.hypot(dx, dy);
        }
        const push = (min - d) / d;
        a.x -= dx * push * (b.w / (a.w + b.w));
        a.y -= dy * push * (b.w / (a.w + b.w));
        b.x += dx * push * (a.w / (a.w + b.w));
        b.y += dy * push * (a.w / (a.w + b.w));
        moved = true;
      }
    }
    if (!moved) break;
  }
  return nodes;
}

export interface StaticPin {
  key: string;
  at: Vec3;
  color: string;
  fg: string;
  size: number;
  glyph: string;
}

export default function StaticHouse({
  variant = "hero",
  className,
  pins,
}: {
  variant?: "hero" | "map";
  className?: string;
  pins?: StaticPin[];
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const C = COLORS[variant];
  const box = (key: string, f: ReturnType<typeof boxFaces>, top: string, front: string, right: string) => (
    <g key={key}>
      <polygon points={f.top} fill={top} />
      <polygon points={f.front} fill={front} />
      <polygon points={f.right} fill={right} />
    </g>
  );
  const openings = (list: typeof G.front, wall: "front" | "right") =>
    list.map((o, i) => (
      <g key={`${wall}${i}`}>
        <polygon points={o.frame} fill="#fbfaf7" />
        {o.kind === "door" ? (
          <polygon points={o.glass[0]} fill="#7b5a3e" />
        ) : (
          <polygon points={o.glass[0]} fill={o.kind === "frosted" ? "#cbd6da" : o.kind === "vent" ? "#4a5256" : `url(#${id}-glass)`} />
        )}
        {o.mullions.length > 0 && <path d={o.mullions.join("")} stroke="#fbfaf7" strokeWidth={2.4} />}
        {o.sill && <path d={o.sill} stroke="#f4f2ee" strokeWidth={3} strokeLinecap="round" />}
      </g>
    ));

  return (
    <svg className={className} viewBox={G.viewBox[variant]} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-disc`}>
          <stop offset="0" stopColor={variant === "map" ? "#eef2f0" : "#ffffff"} stopOpacity="1" />
          <stop offset="0.7" stopColor={variant === "map" ? "#eef2f0" : "#ffffff"} stopOpacity="0.6" />
          <stop offset="1" stopColor={variant === "map" ? "#eef2f0" : "#ffffff"} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8ea4b0" />
          <stop offset="0.45" stopColor={C.glass} />
          <stop offset="1" stopColor="#1b262d" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <polygon points={G.ground} fill={`url(#${id}-disc)`} />
      <polygon points={G.footprint} fill="#14302a" opacity="0.22" filter={`url(#${id}-blur)`} />

      <polygon points={G.rightWall} fill={C.right} />
      <polygon points={G.plinthRight} fill={C.plinthR} />
      {openings(G.right, "right")}
      <polygon points={G.frontWall} fill={C.front} />
      <polygon points={G.plinthFront} fill={C.plinthF} />
      {openings(G.front, "front")}

      {box("cabinet", G.cabinet, "#c3c9cb", "#aab1b3", "#959c9e")}
      {box("canopy", G.canopy, "#f3f1ec", "#e2ded7", "#d0cbc3")}
      {G.steps.map((s, i) => box(`step${i}`, s, "#c9c4bb", C.plinthF, C.plinthR))}
      {box("deck", G.deck, "#bfa483", "#8b7660", "#7c6956")}
      <path d={G.boards} stroke="#a58c6e" strokeWidth={0.8} />
      <polygon points={G.tubBase} fill="#b9bebd" />
      <polygon points={G.tubRim} fill="#dfe2e1" />
      <polygon points={G.water} fill={variant === "map" ? "#a6c6cf" : "#6fa9ba"} />

      {box("chimney", G.chimney, "#e8e5de", "#ece9e2", "#d6d1c9")}
      {box("cap", G.chimneyCap, "#8a857e", "#7a756e", "#6c6761")}
      <polygon points={G.roof} fill={C.roof} />
      <path d={G.ribs} stroke={C.roofLine} strokeWidth={1.1} opacity="0.55" />
      <polygon points={G.fascia} fill="#fbfaf7" />
      <path d={G.gutter} stroke="#aab1b3" strokeWidth={5} strokeLinecap="round" />
      <polyline points={G.barge} fill="none" stroke="#fbfaf7" strokeWidth={6} strokeLinejoin="round" />
      <path d={G.ridge} stroke={C.roofLine} strokeWidth={6} strokeLinecap="round" />
      <path d={G.downpipes} stroke="#aab1b3" strokeWidth={3.6} strokeLinecap="round" />

      {box("balcony", G.balcony, "#f1efea", "#e4e0d9", "#d2cdc5")}
      <path d={G.bars} stroke="#353c3f" strokeWidth={0.9} />
      <path d={G.rail} stroke="#353c3f" strokeWidth={2.2} strokeLinecap="round" />

      {spread(pins ?? []).map(({ p, x, y, r }) => {
        return (
          <g key={p.key}>
            <circle cx={x} cy={y} r={r + 2.2} fill="#ffffff" />
            <circle cx={x} cy={y} r={r} fill={p.color} />
            {p.glyph && (
              <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={r * 1.15} fontWeight={700} fill={p.fg}>
                {p.glyph}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
