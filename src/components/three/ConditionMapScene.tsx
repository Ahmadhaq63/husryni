"use client";

/**
 * Report condition map: the house as a cut-away model (walls and roof facing the camera fade to
 * outlines) with one HTML pin per checklist item, coloured by grade. Pins are real buttons:
 * focusable, arrow keys move between them, and clicking one flies the camera to that part of the
 * house like a drone, with a card showing its findings. A tour flies through the problem areas.
 * Other parts of the report can ask for a flight with flyToItem() (index.tsx). Loaded lazily.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import * as THREE from "three";
import { GRADE_COLOR } from "@/lib/gradeColors";
import type { Grade } from "@/lib/types";
import { resolveAnchors } from "./anchors";
import { TONE_GLYPH, type Tone } from "./conditionVisual";
import { createDrone, type Drone, type Pose } from "./drone";
import { buildHouse, disposeObject } from "./houseModel";
import { H, VIEW, type Vec3 } from "./houseSpec";
import { FLY_EVENT, type DroneUi } from "./flyTo";
import { createStage, frameView, housePoints, type Stage } from "./stage";
import StaticHouse, { type StaticPin } from "./StaticHouse";

export interface MapPin {
  key: string;
  title: string;
  tone: Tone;
  color: string;
  fg: string;
  size: number;
  rank: number;
  /** "Title: legend label", the pin's accessible name. */
  label: string;
  stateLabel: string;
  findings: { title: string; grade: Grade }[];
}

interface Props {
  pins: MapPin[];
  ariaLabel: string;
  anchorPrefix: string;
  activeKey: string | null;
  onActiveKeyChange: (key: string | null) => void;
  ui: DroneUi;
}

type Status = "loading" | "ready" | "failed";

const ELEVATION = THREE.MathUtils.degToRad(26);
const HOME_POLAR: [number, number] = [THREE.MathUtils.degToRad(46), THREE.MathUtils.degToRad(84)];
const FOCUS_POLAR: [number, number] = [THREE.MathUtils.degToRad(18), THREE.MathUtils.degToRad(86)];
/** Seconds the tour stays at each place after arriving. */
const TOUR_DWELL = 3.4;
const FLASH_CLASS = "condition-target-flash";
/** Text stand-ins for the icon glyphs in the SVG drawing. */
const STATIC_GLYPH: Partial<Record<Tone, string>> = { ok: "✓", skipped: "–", pending: "…" };
const flashTimers = new WeakMap<HTMLElement, number>();
const HOUSE_CENTRE = new THREE.Vector3(0, 3, 0);
const TOURED: Tone[] = ["TG3", "TG2", "TG1"];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Scrolls to the item's section in the report and briefly highlights it. */
function goToItem(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // Open collapsed sections on the way, or there is nothing to scroll to.
  for (let d = el.closest("details:not([open])"); d; d = d.parentElement?.closest("details:not([open])") ?? null) {
    (d as HTMLDetailsElement).open = true;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.classList.remove(FLASH_CLASS);
  void el.offsetWidth; // restart the animation when clicked twice
  el.classList.add(FLASH_CLASS); // also sets scroll-margin-top, read by scrollIntoView
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  // Move keyboard focus along, like an in-page link.
  if (!el.matches("a[href], button, input, select, textarea, [tabindex]")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  window.clearTimeout(flashTimers.get(el));
  flashTimers.set(
    el,
    window.setTimeout(() => el.classList.remove(FLASH_CLASS), 1600),
  );
}

/**
 * Where the drone parks for an item: outside the house, on the side the item faces, a little above
 * it and leaning towards the overview direction so the close-up keeps some depth.
 */
function focusPose(at: Vec3, home: Pose): Pose {
  const target = new THREE.Vector3(...at);
  const homeDir = home.position.clone().sub(home.target).setY(0).normalize();
  const out = new THREE.Vector3(target.x - HOUSE_CENTRE.x, 0, target.z - HOUSE_CENTRE.z);
  if (out.lengthSq() < 0.36) out.copy(homeDir);
  else out.normalize();
  const dir = out.multiplyScalar(0.7).addScaledVector(homeDir, 0.3).normalize();
  const high = target.y > H.eave - 0.3;
  const low = target.y < 1.2;
  const distance = high ? 11.5 : 9.6;
  const rise = high ? 6 : low ? 2.8 : 3.4;
  const position = target.clone().addScaledVector(dir, distance);
  position.y = Math.max(1.4, target.y + rise);
  return { position, target };
}

export default function ConditionMapScene({ pins, ariaLabel, anchorPrefix, activeKey, onActiveKeyChange, ui }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const pinEls = useRef(new Map<string, HTMLButtonElement>());
  const leaderEls = useRef(new Map<string, SVGGElement>());
  const tipRef = useRef<HTMLDivElement>(null);
  const invalidateRef = useRef<() => void>(() => {});
  const flyRef = useRef<(key: string | null, opts?: { fromTour?: boolean }) => void>(() => {});
  const tourTimer = useRef(0);
  const [status, setStatus] = useState<Status>("loading");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  /** The item the drone is at (or flying to); null = the whole house. */
  const [droneKey, setDroneKey] = useState<string | null>(null);
  const [tour, setTour] = useState<{ list: string[]; index: number } | null>(null);

  const anchors = useMemo(() => resolveAnchors(pins.map((p) => p.key)), [pins]);
  /** Pins that have a place on the house, most serious first (tab order and stacking). */
  const placed = useMemo(
    () => pins.filter((p) => anchors.has(p.key)).sort((a, b) => b.rank - a.rank),
    [pins, anchors],
  );
  const staticPins = useMemo<StaticPin[]>(
    () =>
      [...placed].reverse().map((p) => ({
        key: p.key,
        at: anchors.get(p.key) as Vec3,
        color: p.color,
        fg: p.fg,
        size: p.size,
        glyph: TONE_GLYPH[p.tone].text ?? STATIC_GLYPH[p.tone] ?? "",
      })),
    [placed, anchors],
  );
  /** The tour visits the problem areas, most serious first; with none, every assessed place. */
  const tourList = useMemo(() => {
    const problems = placed.filter((p) => TOURED.includes(p.tone)).map((p) => p.key);
    return problems.length ? problems : placed.filter((p) => p.tone === "ok").map((p) => p.key);
  }, [placed]);

  // The render loop reads the latest props through refs.
  const live = useRef({ placed, anchors, activeKey, droneKey });
  live.current = { placed, anchors, activeKey, droneKey };
  useEffect(() => {
    invalidateRef.current();
  }, [placed, anchors, activeKey, droneKey]);

  const tabKey = focusKey && placed.some((p) => p.key === focusKey) ? focusKey : placed[0]?.key;
  const active = placed.find((p) => p.key === activeKey) ?? null;
  const focused = placed.find((p) => p.key === droneKey) ?? null;

  const stopTour = useCallback(() => {
    window.clearTimeout(tourTimer.current);
    setTour(null);
  }, []);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const model = buildHouse({ palette: "map", interior: true });
    const points = housePoints();
    // With reduced motion, walls switch between solid and faded without a transition.
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () => motionQuery.matches;
    const camDir = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const anchorVec = new Map<string, THREE.Vector3>();
    let stage: Stage | null = null;
    let drone: Drone | null = null;
    let home: Pose | null = null;
    let first = true;
    let lastTime = -1;
    let introDone = false;
    let io: IntersectionObserver | null = null;

    /** The overview: the whole house from the front-right, fitted to the canvas. */
    const computeHome = (): Pose | null => {
      if (!stage) return null;
      const cam = stage.camera.clone();
      const fit = frameView(cam, points, VIEW.azimuth, ELEVATION, { x: 0.05, y: 0.08 });
      return { position: cam.position.clone(), target: fit.target.clone() };
    };

    const setPolar = ([min, max]: [number, number]) => {
      if (!stage) return;
      stage.controls.minPolarAngle = min;
      stage.controls.maxPolarAngle = max;
    };

    /** Fly to an item (key) or back to the whole house (null). */
    flyRef.current = (key) => {
      if (!stage || !drone || !home) return;
      const at = key ? live.current.anchors.get(key) : null;
      if (key && !at) return;
      // Any flight replaces the arrival flight.
      if (!introDone) {
        introDone = true;
        io?.disconnect();
      }
      setDroneKey(key);
      if (at) {
        setPolar(FOCUS_POLAR);
        drone.flyTo(focusPose(at, home), { hover: true });
      } else {
        drone.flyTo(home, { hover: false, onArrive: () => setPolar(HOME_POLAR) });
      }
    };

    /** Fade the walls and roof slopes that face the camera. Returns true while still fading. */
    const updateGhosts = (dt: number, snap: boolean) => {
      if (!stage) return false;
      camDir.copy(stage.camera.position).sub(stage.controls.target).normalize();
      let moving = false;
      for (const g of model.ghostables) {
        const target = smoothstep(0.08, 0.36, g.normal.dot(camDir));
        g.amount = snap ? target : g.amount + (target - g.amount) * (1 - Math.exp(-dt * 9));
        if (Math.abs(target - g.amount) > 0.003) moving = true;
        else g.amount = target;
        for (const m of g.materials) {
          m.opacity = 1 - g.amount * (1 - g.minOpacity);
          m.depthWrite = g.amount < 0.5;
        }
        g.lines.opacity = g.amount * 0.6;
      }
      return moving;
    };

    const place = () => {
      if (!stage) return;
      const { width, height } = stage.size;
      const { camera } = stage;
      const { placed: list, anchors: anchorMap, activeKey: act } = live.current;
      const nodes = list.map((p) => {
        let v = anchorVec.get(p.key);
        const a = anchorMap.get(p.key);
        if (a && (!v || v.x !== a[0] || v.y !== a[1] || v.z !== a[2])) {
          v = new THREE.Vector3(...a);
          anchorVec.set(p.key, v);
        }
        tmp.copy(v ?? tmp.set(0, 0, 0)).project(camera);
        const ax = ((tmp.x + 1) / 2) * width;
        const ay = ((1 - tmp.y) / 2) * height;
        return { key: p.key, ax, ay, x: ax, y: ay, r: p.size / 2 + 1.5, w: p.rank + 1, behind: tmp.z > 1 };
      });
      // Nudge overlapping pins apart; more serious pins move less.
      for (let iter = 0; iter < 10; iter++) {
        let moved = false;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let d = Math.hypot(dx, dy);
            const min = a.r + b.r;
            if (d >= min) continue;
            if (d < 0.01) {
              dx = 1;
              dy = 0.3;
              d = Math.hypot(dx, dy);
            }
            const push = (min - d) / d;
            const wa = b.w / (a.w + b.w);
            const wb = a.w / (a.w + b.w);
            a.x -= dx * push * wa;
            a.y -= dy * push * wa;
            b.x += dx * push * wb;
            b.y += dy * push * wb;
            moved = true;
          }
        }
        if (!moved) break;
      }
      for (const n of nodes) {
        // Close up, pins can leave the frame: hide those rather than pile them up at the edge.
        const outside = n.behind || n.x < -n.r || n.x > width + n.r || n.y < -n.r || n.y > height + n.r;
        n.x = Math.max(n.r, Math.min(width - n.r, n.x));
        n.y = Math.max(n.r, Math.min(height - n.r, n.y));
        const el = pinEls.current.get(n.key);
        if (el) {
          el.style.transform = `translate3d(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px, 0)`;
          el.style.visibility = outside ? "hidden" : "";
        }
        const leader = leaderEls.current.get(n.key);
        if (leader) {
          const off = !outside && Math.hypot(n.x - n.ax, n.y - n.ay) > n.r * 0.6;
          leader.style.display = off ? "" : "none";
          if (off) {
            const [line, dot] = leader.children as unknown as [SVGLineElement, SVGCircleElement];
            line.setAttribute("x1", n.ax.toFixed(1));
            line.setAttribute("y1", n.ay.toFixed(1));
            line.setAttribute("x2", n.x.toFixed(1));
            line.setAttribute("y2", n.y.toFixed(1));
            dot.setAttribute("cx", n.ax.toFixed(1));
            dot.setAttribute("cy", n.ay.toFixed(1));
          }
        }
      }
      // Tooltip above the active pin (below it near the top edge).
      const tip = tipRef.current;
      const node = act ? nodes.find((n) => n.key === act) : undefined;
      if (tip && node) {
        const tw = tip.offsetWidth;
        const th = tip.offsetHeight;
        const above = node.y - node.r - 10 - th >= 4;
        const tx = Math.max(4, Math.min(width - tw - 4, node.x - tw / 2));
        const ty = above ? node.y - node.r - 10 - th : node.y + node.r + 10;
        tip.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
        tip.dataset.placement = above ? "top" : "bottom";
      }
    };

    stage = createStage({
      host,
      polar: HOME_POLAR,
      ground: "#e9eeec",
      onResize: () => {
        home = computeHome();
        // Re-frame only at the overview: a close-up keeps its place when the window changes size.
        if (home && stage && !drone?.flying() && !live.current.droneKey && introDone) {
          stage.camera.position.copy(home.position);
          stage.controls.target.copy(home.target);
          stage.controls.update();
        }
        updateGhosts(0, true);
      },
      onLost: () => setStatus("failed"),
      onFrame: (_dt, t) => {
        const dt = lastTime < 0 ? 0 : t - lastTime;
        lastTime = t;
        const flying = drone?.update(dt) ?? false;
        const fading = updateGhosts(dt, reduced());
        return flying || fading;
      },
      afterRender: () => {
        place();
        if (first) {
          first = false;
          setStatus("ready");
        }
      },
    });
    if (!stage) {
      disposeObject(model.group);
      setStatus("failed");
      return;
    }
    stage.scene.add(model.group);
    drone = createDrone(stage, reduced);
    home = computeHome();
    invalidateRef.current = stage.invalidate;

    // Arrival: the drone flies in from high up the first time the map comes into view.
    if (home && !reduced()) {
      const start = home.position.clone().sub(home.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-58));
      start.multiplyScalar(1.75).add(home.target);
      start.y += 9;
      stage.camera.position.copy(start);
      stage.controls.target.copy(home.target);
      stage.camera.lookAt(home.target);
      stage.controls.enabled = false;
    } else {
      introDone = true;
      if (home) {
        stage.camera.position.copy(home.position);
        stage.controls.target.copy(home.target);
        stage.controls.update();
      }
    }
    io = new IntersectionObserver(
      (entries) => {
        if (introDone || !entries.some((e) => e.isIntersecting) || !drone || !home) return;
        introDone = true;
        io?.disconnect();
        drone.flyTo(home, { duration: 2.6, lift: 2, hover: false });
      },
      { threshold: 0.35 },
    );
    io.observe(host);
    updateGhosts(0, true);
    stage.invalidate();

    // Dragging the model takes over from the tour.
    const onDrag = () => {
      window.clearTimeout(tourTimer.current);
      setTour(null);
    };
    stage.controls.addEventListener("start", onDrag);

    return () => {
      io?.disconnect();
      stage?.controls.removeEventListener("start", onDrag);
      flyRef.current = () => {};
      invalidateRef.current = () => {};
      stage?.dispose();
      stage = null;
      drone = null;
    };
  }, []);

  // Tour: fly to each place in turn, stay a moment, then on to the next; end at the whole house.
  useEffect(() => {
    window.clearTimeout(tourTimer.current);
    if (!tour) return;
    const key = tour.list[tour.index];
    flyRef.current(key ?? null);
    if (!key) {
      setTour(null);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Flights take up to about 2.6 s; with reduced motion the camera cuts.
    tourTimer.current = window.setTimeout(() => setTour((t) => (t ? { ...t, index: t.index + 1 } : t)), (TOUR_DWELL + (reduced ? 0 : 2.4)) * 1000);
    return () => window.clearTimeout(tourTimer.current);
  }, [tour]);

  // Other parts of the report ask for a flight with flyToItem(): bring the map into view, then fly.
  useEffect(() => {
    const onFly = (e: Event) => {
      const key = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (!key || !anchors.has(key)) return;
      stopTour();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      // Let the scroll start first, so the flight plays where it can be seen.
      window.setTimeout(() => flyRef.current(key), reduced ? 0 : 450);
    };
    window.addEventListener(FLY_EVENT, onFly);
    return () => window.removeEventListener(FLY_EVENT, onFly);
  }, [anchors, stopTour]);

  useEffect(() => () => window.clearTimeout(tourTimer.current), []);

  const fly = (key: string | null) => {
    stopTour();
    flyRef.current(key);
  };
  const step = (delta: number) => {
    if (!placed.length) return;
    const i = Math.max(0, placed.findIndex((p) => p.key === droneKey));
    fly(placed[(i + delta + placed.length) % placed.length].key);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = placed.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    const key = placed[next].key;
    setFocusKey(key);
    pinEls.current.get(key)?.focus();
  };

  const touring = tour !== null;
  const stepText = tour && droneKey ? ui.step.replace("{i}", String(tour.index + 1)).replace("{n}", String(tour.list.length)) : null;

  return (
    <div
      ref={rootRef}
      className={`three-stage cmap-stage${droneKey ? " is-drone" : ""}${touring ? " is-touring" : ""}`}
      data-status={status}
      onKeyDown={(e) => {
        if (e.key === "Escape" && (droneKey || touring)) {
          e.preventDefault();
          fly(null);
        }
      }}
    >
      <StaticHouse variant="map" className="three-fallback" pins={staticPins} />
      <div ref={canvasHostRef} className="three-canvas-host" role="img" aria-label={ariaLabel} />
      {status !== "failed" && (
        <>
          <svg className="cmap-leaders" aria-hidden="true">
            {placed.map((p) => (
              <g
                key={p.key}
                style={{ display: "none" }}
                ref={(el) => {
                  if (el) leaderEls.current.set(p.key, el);
                  else leaderEls.current.delete(p.key);
                }}
              >
                <line />
                <circle r={2.6} />
              </g>
            ))}
          </svg>
          <div className="cmap-pins" role="toolbar" aria-label={ariaLabel} aria-orientation="horizontal">
            {placed.map((p, i) => {
              const glyph = TONE_GLYPH[p.tone];
              return (
                <button
                  key={p.key}
                  type="button"
                  className={`cmap-pin${p.key === activeKey ? " is-active" : ""}${p.key === droneKey ? " is-focus" : ""}`}
                  data-tone={p.tone}
                  style={
                    {
                      "--pin": p.color,
                      "--pin-fg": p.fg,
                      "--pin-size": `${p.size}px`,
                      zIndex: p.key === activeKey || p.key === droneKey ? 100 : 10 + p.rank,
                    } as CSSProperties
                  }
                  tabIndex={p.key === tabKey ? 0 : -1}
                  aria-label={p.label}
                  aria-pressed={p.key === droneKey}
                  ref={(el) => {
                    if (el) pinEls.current.set(p.key, el);
                    else pinEls.current.delete(p.key);
                  }}
                  onClick={() => fly(p.key)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  onFocus={() => {
                    setFocusKey(p.key);
                    onActiveKeyChange(p.key);
                  }}
                  onBlur={() => onActiveKeyChange(null)}
                  onMouseEnter={() => onActiveKeyChange(p.key)}
                  onMouseLeave={() => onActiveKeyChange(null)}
                >
                  <span className="cmap-pin-dot" aria-hidden="true">
                    {glyph.icon ? <i className={`bi ${glyph.icon}`} /> : glyph.text}
                  </span>
                </button>
              );
            })}
          </div>
          <div ref={tipRef} className={`cmap-tip${active && !droneKey ? " is-visible" : ""}`} aria-hidden="true">
            {active && (
              <>
                <span className="cmap-tip-title">{active.title}</span>
                <span className="cmap-tip-state">
                  <span className="cmap-swatch" style={{ "--pin": active.color } as CSSProperties} />
                  {active.stateLabel}
                </span>
              </>
            )}
          </div>

          <div className="cmap-hud" aria-hidden="true" />
          <div className="cmap-controls">
            {status === "ready" && tourList.length > 0 && (
              <button
                type="button"
                className={`cmap-ctl${touring ? " is-on" : ""}`}
                onClick={() => (touring ? fly(null) : setTour({ list: tourList, index: 0 }))}
              >
                <i className={`bi ${touring ? "bi-stop-fill" : "bi-play-fill"}`} aria-hidden="true" />
                {touring ? ui.stop : ui.tour}
              </button>
            )}
            {droneKey && !touring && (
              <button type="button" className="cmap-ctl" onClick={() => fly(null)}>
                <i className="bi bi-arrows-fullscreen" aria-hidden="true" />
                {ui.home}
              </button>
            )}
          </div>
          {!droneKey && status === "ready" && <p className="cmap-hint">{ui.hint}</p>}

          <section className={`cmap-card${focused ? " is-open" : ""}`} aria-live="polite" aria-label={ui.view}>
            {focused && (
              <>
                <div className="cmap-card-top">
                  <span className="cmap-card-eyebrow">
                    <i className="bi bi-crosshair" aria-hidden="true" /> {ui.view}
                    {stepText && <span className="cmap-card-step"> · {stepText}</span>}
                  </span>
                  <span className="cmap-card-state" style={{ "--pin": focused.color } as CSSProperties}>
                    <span className="cmap-swatch" />
                    {focused.stateLabel}
                  </span>
                </div>
                <h3 className="cmap-card-title">{focused.title}</h3>
                {focused.findings.length ? (
                  <ul className="cmap-card-findings">
                    {focused.findings.map((f, i) => (
                      <li key={i}>
                        <span className="cmap-card-grade" style={{ background: GRADE_COLOR[f.grade].soft, color: GRADE_COLOR[f.grade].text }}>
                          {f.grade}
                        </span>
                        {f.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="cmap-card-none">{ui.none}</p>
                )}
                <div className="cmap-card-actions">
                  <button type="button" className="cmap-card-btn" onClick={() => step(-1)} aria-label={ui.prev} title={ui.prev}>
                    <i className="bi bi-chevron-left" aria-hidden="true" />
                  </button>
                  <button type="button" className="cmap-card-btn" onClick={() => step(1)} aria-label={ui.next} title={ui.next}>
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="cmap-card-btn is-primary"
                    onClick={() => {
                      stopTour();
                      goToItem(`${anchorPrefix}${focused.key}`);
                    }}
                  >
                    {ui.inReport}
                    <i className="bi bi-arrow-down-short" aria-hidden="true" />
                  </button>
                  <button type="button" className="cmap-card-btn" onClick={() => fly(null)}>
                    {ui.home}
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
