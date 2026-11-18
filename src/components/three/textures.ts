/**
 * Small textures drawn on a canvas at runtime, so the scenes need no network assets.
 */
import * as THREE from "three";

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

/** Deterministic pseudo-random numbers, so every render of the model looks the same. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Faint mottling for rendered concrete, multiplied with the wall colour. Tiles every ~3 m. */
export function concreteTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  const rand = rng(7);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 8 + rand() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.012 + rand() * 0.022;
    g.addColorStop(0, `rgba(90,84,74,${a})`);
    g.addColorStop(1, "rgba(90,84,74,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 2600; i++) {
    const v = rand() < 0.5 ? 70 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.035 + rand() * 0.05})`;
    ctx.fillRect(rand() * 256, rand() * 256, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.33, 0.33);
  t.anisotropy = 4;
  return t;
}

/** Dark glass with a soft sky reflection towards the top and a diagonal sheen. */
export function glassTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#8ea4b0");
  g.addColorStop(0.42, "#3e515c");
  g.addColorStop(1, "#1b262d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 128);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(10, 128);
  ctx.lineTo(34, 128);
  ctx.lineTo(64, 40);
  ctx.lineTo(64, 6);
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Radial alpha falloff for the round ground disc (white centre fading to transparent). */
export function discTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.85)");
  g.addColorStop(0.8, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Soft contact shadow: blurred rectangles for the footprints, drawn with shadowBlur (works in
 * every browser, unlike ctx.filter). `rects` are in metres within a square of `extent` metres.
 */
export function contactShadowTexture(
  rects: { x0: number; x1: number; z0: number; z1: number; strength: number }[],
  extent: number,
): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = canvas(size, size);
  const k = size / extent;
  const toPx = (m: number) => size / 2 + m * k;
  const off = size * 2;
  for (const pass of [
    { blur: 26, alpha: 0.55 },
    { blur: 7, alpha: 0.6 },
  ]) {
    for (const r of rects) {
      ctx.save();
      ctx.shadowColor = `rgba(20,32,28,${pass.alpha * r.strength})`;
      ctx.shadowBlur = pass.blur;
      ctx.shadowOffsetX = off;
      ctx.fillStyle = "#000";
      ctx.fillRect(toPx(r.x0) - off, toPx(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k);
      ctx.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
