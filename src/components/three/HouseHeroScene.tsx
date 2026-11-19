"use client";

/**
 * Landing-page hero: the house on a transparent background, slowly swinging left and right, with
 * a teal "AI scan" sweeping up through it. Six labelled hotspots light up as the scan passes.
 * Loaded lazily through index.tsx (three.js never reaches the server or other pages).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HERO_HOTSPOTS } from "./anchors";
import { createDrone, type Drone, type Pose } from "./drone";
import { buildHouse, disposeObject } from "./houseModel";
import { DECK, H, RIDGE_TOP, VIEW } from "./houseSpec";
import type { HeroLabelKey, HeroUi } from "./index";
import { applyScan, createScanUniforms } from "./scanEffect";
import { createStage, frameView, housePoints, type Stage } from "./stage";
import StaticHouse from "./StaticHouse";

const ACCENT = "#2fb5a0";
/** Camera swing: ±16° around the default view over 18 s. */
const SWING = THREE.MathUtils.degToRad(16);
const SWING_PERIOD = 18;
/** Scan cycle: sweep up, hold with every hotspot lit, rest. */
const CYCLE = 7.5;
const SWEEP = 3.2;
const HOLD = 5.9;
const FIRST_SCAN = 0.8;
const SCAN_FROM = -0.3;
const SCAN_TO = RIDGE_TOP + 1.3;
const LABEL_GAP = 16;
/** Below this width (CSS px) labels are compact; matches the container query in three.css. */
const COMPACT = 480;
/** Narrow heroes swing less, so the labels beside the house keep their room. */
const swingFor = (width: number) => (width < COMPACT ? SWING * 0.6 : SWING);

type Status = "loading" | "ready" | "failed";

const HOME_POLAR: [number, number] = [THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(84)];
const FOCUS_POLAR: [number, number] = [THREE.MathUtils.degToRad(20), THREE.MathUtils.degToRad(88)];

/** Where the drone parks for a hotspot: out along the surface's normal, a little above, leaning to the overview. */
function heroFocusPose(at: THREE.Vector3, normal: THREE.Vector3, home: Pose): Pose {
  const homeDir = home.position.clone().sub(home.target).setY(0).normalize();
  const dir = normal.clone().setY(0);
  if (dir.lengthSq() < 0.01) dir.copy(homeDir);
  dir.normalize().multiplyScalar(0.72).addScaledVector(homeDir, 0.28).normalize();
  const roof = normal.y > 0.5;
  // The hero frame is small: stay far enough back that the surroundings still show.
  const position = at.clone().addScaledVector(dir, roof ? 15 : 12);
  position.y = Math.max(1.6, at.y + (roof ? 8 : 3.6));
  return { position, target: at.clone() };
}

export default function HouseHeroScene({
  labels,
  details,
  ui,
  ariaLabel,
}: {
  labels: Record<HeroLabelKey, string>;
  /** What we check at each hotspot: when given, labels are buttons that fly the camera there. */
  details?: Record<HeroLabelKey, string>;
  ui?: HeroUi;
  ariaLabel?: string;
}) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const pinEls = useRef<(HTMLSpanElement | null)[]>([]);
  const labelEls = useRef<(HTMLSpanElement | null)[]>([]);
  const lineEls = useRef<(SVGLineElement | null)[]>([]);
  const labelSizes = useRef<{ w: number; h: number }[]>([]);
  const invalidateRef = useRef<() => void>(() => {});
  const measureRef = useRef<() => void>(() => {});
  const flyRef = useRef<(index: number | null) => void>(() => {});
  const [status, setStatus] = useState<Status>("loading");
  /** The hotspot the drone is at; null = the whole house (swinging gently). */
  const [focus, setFocus] = useState<number | null>(null);
  const focusRef = useRef<number | null>(null);
  focusRef.current = focus;
  const interactive = !!details;

  // Label sizes are measured once per text change, not every frame.
  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive) return;
      labelSizes.current = labelEls.current.map((el) => ({ w: el?.offsetWidth ?? 0, h: el?.offsetHeight ?? 0 }));
      invalidateRef.current();
    };
    measureRef.current = measure;
    measure();
    document.fonts?.ready.then(measure, () => {});
    return () => {
      alive = false;
      measureRef.current = () => {};
    };
  }, [labels, status]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery.matches;

    const model = buildHouse({ palette: "hero", interior: false });
    const scan = createScanUniforms(ACCENT);
    model.materials.forEach((m) => applyScan(m, scan));

    // Translucent scan plane with a crisp outline, slightly larger than house and deck.
    const scanGroup = new THREE.Group();
    const outline = new THREE.Shape();
    {
      const x0 = -H.halfW - 0.9;
      const x1 = DECK.x1 + 0.7;
      const z0 = -H.halfD - 0.9;
      const z1 = H.halfD + 2.0;
      const r = 0.9;
      // Shape y maps to world -z after rotating the plane flat.
      outline.moveTo(x0 + r, -z1);
      outline.lineTo(x1 - r, -z1);
      outline.quadraticCurveTo(x1, -z1, x1, -z1 + r);
      outline.lineTo(x1, -z0 - r);
      outline.quadraticCurveTo(x1, -z0, x1 - r, -z0);
      outline.lineTo(x0 + r, -z0);
      outline.quadraticCurveTo(x0, -z0, x0, -z0 - r);
      outline.lineTo(x0, -z1 + r);
      outline.quadraticCurveTo(x0, -z1, x0 + r, -z1);
    }
    const fillMat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(outline, 6), fillMat);
    fill.rotation.x = -Math.PI / 2;
    const edgeMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(outline.getPoints(6).map((p) => new THREE.Vector3(p.x, 0, -p.y))),
      edgeMat,
    );
    scanGroup.add(fill, edge);
    scanGroup.visible = false;
    scanGroup.renderOrder = 5;

    const anchors = HERO_HOTSPOTS.map((h) => ({
      at: new THREE.Vector3(...h.at),
      normal: new THREE.Vector3(...h.normal),
      side: h.side,
    }));
    const points = housePoints();
    const lit = anchors.map(() => false);
    const setLit = (i: number, on: boolean) => {
      if (lit[i] === on) return;
      lit[i] = on;
      pinEls.current[i]?.classList.toggle("is-lit", on);
      labelEls.current[i]?.classList.toggle("is-lit", on);
    };
    /** Reduced motion: a still frame, no swing, no scan, every hotspot shown as checked. */
    const applyMotionPreference = () => {
      if (!reduced) return;
      scan.uScanStrength.value = 0;
      scanGroup.visible = false;
      anchors.forEach((_, i) => setLit(i, true));
    };
    applyMotionPreference();

    let stage: Stage | null = null;
    let drone: Drone | null = null;
    let first = true;
    let distance = 30;
    let idle = Infinity;
    let phase = 0;
    const sph = new THREE.Spherical();
    const tmp = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    const frame = () => {
      if (!stage) return;
      const width = Math.max(stage.size.width, 1);
      // Fraction of the half-width kept free at each side, room for the labels.
      const padX = width < COMPACT ? 0.42 : Math.min(0.24, 70 / width + 0.05);
      const fit = frameView(
        stage.camera,
        points,
        VIEW.azimuth,
        VIEW.elevation,
        { x: padX, y: 0.06 },
        reduced ? 0 : swingFor(width),
      );
      stage.controls.target.copy(fit.target);
      distance = fit.distance;
      stage.controls.update();
    };

    const place = () => {
      if (!stage) return;
      const { width, height } = stage.size;
      const { camera, controls } = stage;
      const gap = width < COMPACT ? 11 : LABEL_GAP;
      camDir.copy(camera.position).sub(controls.target).normalize();
      const items = anchors.map((a, i) => {
        tmp.copy(a.at).project(camera);
        const px = ((tmp.x + 1) / 2) * width;
        const py = ((1 - tmp.y) / 2) * height;
        const { w, h } = labelSizes.current[i] ?? { w: 0, h: 0 };
        // Preferred side, pushed in from the edge if needed; flip only if it would cover its pin.
        const left = Math.max(4, px - gap - w);
        const right = Math.min(width - w - 4, px + gap);
        const leftOk = left + w <= px - 4;
        const rightOk = right >= px + 4;
        const lx = a.side === "left" ? (leftOk || !rightOk ? left : right) : rightOk || !leftOk ? right : left;
        return { i, px, py, lx, ly: py - h / 2, w, h, visible: a.normal.dot(camDir) > 0.02 };
      });
      // Push overlapping labels apart vertically, top to bottom.
      const order = items.filter((it) => it.visible).sort((a, b) => a.ly - b.ly);
      for (let j = 1; j < order.length; j++) {
        const b = order[j];
        for (let k = 0; k < j; k++) {
          const a = order[k];
          const overlapX = a.lx < b.lx + b.w + 6 && b.lx < a.lx + a.w + 6;
          if (overlapX && b.ly < a.ly + a.h + 5) b.ly = a.ly + a.h + 5;
        }
      }
      for (const it of items) {
        it.ly = Math.max(4, Math.min(height - it.h - 4, it.ly));
        const pin = pinEls.current[it.i];
        const label = labelEls.current[it.i];
        const line = lineEls.current[it.i];
        const opacity = it.visible ? "1" : "0";
        if (pin) {
          pin.style.transform = `translate3d(${it.px.toFixed(1)}px, ${it.py.toFixed(1)}px, 0)`;
          pin.style.opacity = opacity;
        }
        if (label) {
          label.style.transform = `translate3d(${it.lx.toFixed(1)}px, ${it.ly.toFixed(1)}px, 0)`;
          label.style.opacity = opacity;
        }
        if (line) {
          const ex = it.lx < it.px ? it.lx + it.w : it.lx;
          line.setAttribute("x1", it.px.toFixed(1));
          line.setAttribute("y1", it.py.toFixed(1));
          line.setAttribute("x2", ex.toFixed(1));
          line.setAttribute("y2", (it.ly + it.h / 2).toFixed(1));
          line.style.opacity = opacity;
        }
      }
    };

    stage = createStage({
      host,
      polar: [THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(84)],
      ground: "#ffffff",
      onResize: () => {
        // A close-up keeps its place when the window changes size; the overview is re-fitted.
        if (focusRef.current === null && !drone?.flying()) frame();
        // Label styles depend on the hero's width (container query), so sizes change too.
        measureRef.current();
      },
      onLost: () => setStatus("failed"),
      afterRender: () => {
        place();
        if (first) {
          first = false;
          setStatus("ready");
        }
      },
      onFrame: (dt, t) => {
        if (!stage) return false;
        // A drone flight, or parked at a hotspot: no swing and no scan, the focused hotspot stays lit.
        const flying = drone?.update(dt) ?? false;
        if (flying || focusRef.current !== null) {
          scan.uScanStrength.value = 0;
          scanGroup.visible = false;
          anchors.forEach((_, i) => setLit(i, i === focusRef.current));
          idle = 0;
          return flying;
        }
        if (reduced) return false;
        const { camera, controls } = stage;

        // Gentle swing; after the user drags, wait a moment and glide back onto the path.
        if (stage.interacting()) idle = 0;
        else idle += dt;
        if (idle > 2.2) {
          phase += dt;
          const ramp = Math.min(1, (idle - 2.2) / 2.5);
          const az = VIEW.azimuth + swingFor(stage.size.width) * Math.sin((phase / SWING_PERIOD) * Math.PI * 2);
          sph.setFromVector3(tmp.copy(camera.position).sub(controls.target));
          const k = (1 - Math.exp(-dt * 2.4)) * ramp;
          const dAz = Math.atan2(Math.sin(az - sph.theta), Math.cos(az - sph.theta));
          sph.theta += dAz * k;
          sph.phi += (Math.PI / 2 - VIEW.elevation - sph.phi) * k;
          sph.radius = distance;
          camera.position.setFromSpherical(sph).add(controls.target);
        }

        // Scan sweep.
        const c = t < FIRST_SCAN ? -1 : (t - FIRST_SCAN) % CYCLE;
        let y = -10;
        let strength = 0;
        if (c >= 0 && c < SWEEP) {
          const p = c / SWEEP;
          const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          y = SCAN_FROM + e * (SCAN_TO - SCAN_FROM);
          strength = Math.min(1, c / 0.3, (SWEEP - c) / 0.5);
        }
        scan.uScanY.value = y;
        scan.uScanStrength.value = strength;
        scanGroup.visible = strength > 0.001;
        scanGroup.position.y = y;
        fillMat.opacity = 0.07 * strength;
        edgeMat.opacity = 0.7 * strength;
        anchors.forEach((a, i) => setLit(i, c >= 0 && (c < SWEEP ? a.at.y <= y : c < HOLD)));
        return true;
      },
    });

    if (!stage) {
      disposeObject(model.group);
      disposeObject(scanGroup);
      setStatus("failed");
      return;
    }
    stage.scene.add(model.group, scanGroup);
    invalidateRef.current = stage.invalidate;
    drone = createDrone(stage, () => motionQuery.matches);
    /** The overview the swing starts from, fitted to the canvas (a clone, so the live camera stays put). */
    const homePose = (): Pose | null => {
      if (!stage) return null;
      const cam = stage.camera.clone();
      const width = Math.max(stage.size.width, 1);
      const padX = width < COMPACT ? 0.42 : Math.min(0.24, 70 / width + 0.05);
      const fit = frameView(cam, points, VIEW.azimuth, VIEW.elevation, { x: padX, y: 0.06 }, reduced ? 0 : swingFor(width));
      return { position: cam.position.clone(), target: fit.target.clone() };
    };
    flyRef.current = (index) => {
      if (!stage || !drone) return;
      const home = homePose();
      if (!home) return;
      if (index === null) {
        drone.flyTo(home, {
          hover: false,
          onArrive: () => {
            stage!.controls.minPolarAngle = HOME_POLAR[0];
            stage!.controls.maxPolarAngle = HOME_POLAR[1];
            phase = 0;
            idle = 0;
          },
        });
        return;
      }
      stage.controls.minPolarAngle = FOCUS_POLAR[0];
      stage.controls.maxPolarAngle = FOCUS_POLAR[1];
      drone.flyTo(heroFocusPose(anchors[index].at, anchors[index].normal, home), { hover: true });
    };
    stage.invalidate();

    const onMotionChange = () => {
      reduced = motionQuery.matches;
      applyMotionPreference();
      frame();
      stage?.invalidate();
    };
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      motionQuery.removeEventListener("change", onMotionChange);
      flyRef.current = () => {};
      invalidateRef.current = () => {};
      stage?.dispose();
      stage = null;
    };
  }, []);

  const fly = (index: number | null) => {
    setFocus(index);
    flyRef.current(index);
  };

  return (
    <div
      className={`three-stage three-hero-stage${focus !== null ? " is-drone" : ""}${interactive ? " is-interactive" : ""}`}
      data-status={status}
      onKeyDown={(e) => {
        if (e.key === "Escape" && focus !== null) {
          e.preventDefault();
          fly(null);
        }
      }}
    >
      <StaticHouse variant="hero" className="three-fallback" />
      <div ref={canvasHostRef} className="three-canvas-host" role={ariaLabel ? "img" : undefined} aria-label={ariaLabel} />
      {status !== "failed" && (
        <div className="three-hero-overlay">
          <svg className="three-hero-leaders" aria-hidden="true">
            {HERO_HOTSPOTS.map((h, i) => (
              <line
                key={h.key}
                ref={(el) => {
                  lineEls.current[i] = el;
                }}
              />
            ))}
          </svg>
          {HERO_HOTSPOTS.map((h, i) => (
            <span
              key={h.key}
              className="three-hero-pin"
              aria-hidden="true"
              ref={(el) => {
                pinEls.current[i] = el;
              }}
            />
          ))}
          {HERO_HOTSPOTS.map((h, i) =>
            interactive ? (
              <button
                key={h.key}
                type="button"
                className={`three-hero-label${focus === i ? " is-focus" : ""}`}
                aria-pressed={focus === i}
                ref={(el) => {
                  labelEls.current[i] = el as unknown as HTMLSpanElement;
                }}
                onClick={() => fly(focus === i ? null : i)}
              >
                {labels[h.key]}
              </button>
            ) : (
              <span
                key={h.key}
                className="three-hero-label"
                aria-hidden="true"
                ref={(el) => {
                  labelEls.current[i] = el;
                }}
              >
                {labels[h.key]}
              </span>
            ),
          )}
          {interactive && (
            <section className={`three-hero-card${focus !== null ? " is-open" : ""}`} aria-live="polite">
              {focus !== null && details && (
                <>
                  <span className="three-hero-card-eyebrow">
                    <i className="bi bi-crosshair" aria-hidden="true" /> {ui?.check ?? "What we check"}
                  </span>
                  <h3 className="three-hero-card-title">{labels[HERO_HOTSPOTS[focus].key]}</h3>
                  <p className="three-hero-card-text">{details[HERO_HOTSPOTS[focus].key]}</p>
                  <button type="button" className="three-hero-card-back" onClick={() => fly(null)}>
                    <i className="bi bi-arrows-fullscreen" aria-hidden="true" /> {ui?.back ?? "Whole house"}
                  </button>
                </>
              )}
            </section>
          )}
          {interactive && focus === null && status === "ready" && <p className="three-hero-hint">{ui?.explore ?? "Click a label for a closer look"}</p>}
        </div>
      )}
    </div>
  );
}
