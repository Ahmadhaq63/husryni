/**
 * Shared three.js setup for both scenes: renderer, lights, ground, camera, orbit controls, an
 * on-demand render loop that pauses off-screen or in a hidden tab, and full teardown.
 *
 * Each mount creates its own canvas, so React StrictMode's mount → unmount → mount never reuses
 * a WebGL context that was just released.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { disposeObject } from "./houseModel";
import { DECK, FRAME_POINTS, H } from "./houseSpec";
import { contactShadowTexture, discTexture } from "./textures";

export interface StageOptions {
  host: HTMLElement;
  /** Polar angle limits of the orbit, in radians from straight up. */
  polar: [number, number];
  /** Colour of the round ground disc. */
  ground: string;
  /** Advance animations. Return true to keep the loop running. */
  onFrame: (dt: number, elapsed: number) => boolean;
  /** After every rendered frame, e.g. to place HTML overlays. */
  afterRender: () => void;
  /** After the canvas changed size (CSS pixels). */
  onResize: (width: number, height: number) => void;
  /** The WebGL context was lost: the caller should show its static fallback. */
  onLost: () => void;
}

export interface Stage {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** CSS size of the canvas. */
  size: { width: number; height: number };
  /** True while the user is dragging. */
  interacting: () => boolean;
  /** Request a frame (the loop runs while onFrame or the controls' damping want more). */
  invalidate: () => void;
  dispose: () => void;
}

const FOV = 30;

/** Creates the stage, or returns null when WebGL 2 is unavailable. */
export function createStage(opts: StageOptions): Stage | null {
  const { host } = opts;
  const canvas = document.createElement("canvas");
  canvas.className = "three-canvas";
  // Ask for the context ourselves: three.js logs an error when it cannot create one.
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      depth: true,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "default",
    });
  } catch {
    gl = null;
  }
  if (!gl) return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Nothing that casts a shadow moves, so the shadow map is drawn once.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 200);

  // Soft daylight: sky/ground hemisphere, a warm key light with soft shadows, a cool fill.
  const hemi = new THREE.HemisphereLight("#ffffff", "#cdd6d1", 1.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff6ea", 2.5);
  // High and from the front left: the front is lit, the right gable in soft shade, and the
  // shadow falls mostly behind the house.
  sun.position.set(-4.5, 24, 12);
  sun.target.position.set(1.5, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  const sc = sun.shadow.camera;
  sc.left = -13;
  sc.right = 13;
  sc.top = 13;
  sc.bottom = -13;
  sc.near = 2;
  sc.far = 60;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight("#e9f1ff", 0.55);
  fill.position.set(14, 6, -6);
  scene.add(fill);

  // Ground: a disc that fades out at the rim, the sun's shadow, and a tight contact shadow.
  const groundCenter = new THREE.Vector3((-H.halfW + DECK.x1) / 2, 0, 0.6);
  const radius = 10.5;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 72),
    new THREE.MeshBasicMaterial({ color: opts.ground, map: discTexture(), transparent: true, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.copy(groundCenter);
  disc.renderOrder = -3;
  scene.add(disc);
  const contactExtent = 22;
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(contactExtent, contactExtent),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture(
        [
          { x0: -H.halfW - 0.05, x1: H.halfW + 0.05, z0: -H.halfD - 0.05, z1: H.halfD + 0.05, strength: 1 },
          { x0: DECK.x0, x1: DECK.x1, z0: DECK.z0, z1: DECK.z1, strength: 0.55 },
        ],
        contactExtent,
      ),
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.003;
  contact.renderOrder = -2;
  scene.add(contact);
  const catcher = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 72),
    new THREE.ShadowMaterial({ color: "#10302a", opacity: 0.2, depthWrite: false }),
  );
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.set(groundCenter.x, 0.006, groundCenter.z);
  catcher.receiveShadow = true;
  catcher.renderOrder = -1;
  scene.add(catcher);

  // Orbit by dragging. No zoom or pan, so wheel and touch scrolling stay with the page.
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;
  // Inertia keeps the model turning after release: skip it when reduced motion is preferred.
  controls.enableDamping = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.55;
  controls.minPolarAngle = opts.polar[0];
  controls.maxPolarAngle = opts.polar[1];
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: null };
  controls.cursorStyle = "grab";
  // OrbitControls sets touch-action: none. Let vertical swipes and pinch-zoom reach the page.
  canvas.style.touchAction = "pan-y pinch-zoom";

  let dragging = false;
  const onStart = () => {
    dragging = true;
    invalidate();
  };
  const onEnd = () => {
    dragging = false;
    invalidate();
  };
  const onChange = () => invalidate();
  controls.addEventListener("start", onStart);
  controls.addEventListener("end", onEnd);
  controls.addEventListener("change", onChange);

  // --------------------------------------------------------------- loop
  let disposed = false;
  /** The WebGL context was lost: nothing renders any more. */
  let lost = false;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let inView = true;
  let pageVisible = !document.hidden;

  let rendered = false;
  const tick = (now: number) => {
    raf = 0;
    if (disposed || size.width === 0) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    elapsed += dt;
    const animating = opts.onFrame(dt, elapsed);
    const moving = controls.update();
    renderer.render(scene, camera);
    rendered = true;
    opts.afterRender();
    if (animating || moving || dragging) schedule();
    else last = 0;
  };
  function schedule() {
    // The first frame always renders, so a scene below the fold is ready when scrolled to.
    if (disposed || lost || raf || (rendered && (!inView || !pageVisible))) return;
    raf = requestAnimationFrame(tick);
  }
  function invalidate() {
    schedule();
  }
  const pause = () => {
    if (!rendered) return; // let the first frame through
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  const size = { width: 0, height: 0 };
  const applySize = (w: number, h: number) => {
    if (w < 2 || h < 2 || (w === size.width && h === size.height)) return;
    size.width = w;
    size.height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    opts.onResize(w, h);
    invalidate();
  };
  const ro = new ResizeObserver((entries) => {
    const r = entries[0]?.contentRect;
    if (r) applySize(Math.round(r.width), Math.round(r.height));
  });
  // The first callback arrives before the next paint and sizes the canvas.
  ro.observe(host);

  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      if (inView) schedule();
      else pause();
    },
    { rootMargin: "120px" },
  );
  io.observe(host);

  const onVisibility = () => {
    pageVisible = !document.hidden;
    if (pageVisible) schedule();
    else pause();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onLost = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lost = true;
    opts.onLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onLost);
    controls.removeEventListener("start", onStart);
    controls.removeEventListener("end", onEnd);
    controls.removeEventListener("change", onChange);
    controls.dispose();
    disposeObject(scene);
    scene.clear();
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };

  return {
    canvas,
    renderer,
    scene,
    camera,
    controls,
    size,
    interacting: () => dragging,
    invalidate,
    dispose,
  };
}

// ------------------------------------------------------------------ framing

const UP = new THREE.Vector3(0, 1, 0);

/** Unit vector from the target towards the camera. */
export function viewDirection(azimuth: number, elevation: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  );
}

/**
 * Smallest camera distance at which every point fits the view, leaving `pad` (fraction of the
 * half-width / half-height) free at the edges.
 */
function fitDistance(
  points: THREE.Vector3[],
  target: THREE.Vector3,
  dir: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  pad: { x: number; y: number },
): number {
  const f = dir.clone().negate();
  const r = new THREE.Vector3().crossVectors(f, UP).normalize();
  const u = new THREE.Vector3().crossVectors(r, f).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (1 - pad.y);
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * (1 - pad.x);
  const rel = new THREE.Vector3();
  let d = 0;
  for (const p of points) {
    rel.copy(p).sub(target);
    const z = rel.dot(f);
    d = Math.max(d, Math.abs(rel.dot(r)) / tanH - z, Math.abs(rel.dot(u)) / tanV - z);
  }
  return d;
}

/**
 * Places the camera so the points are centred and fill the view, from the given direction.
 * `azimuthSpan` widens the fit for scenes that swing the camera left and right.
 * `shiftY` moves the subject up (+) or down (-) as a fraction of the view height.
 */
export function frameView(
  camera: THREE.PerspectiveCamera,
  points: THREE.Vector3[],
  azimuth: number,
  elevation: number,
  pad: { x: number; y: number },
  azimuthSpan = 0,
  shiftY = 0,
): { target: THREE.Vector3; distance: number } {
  const dir = viewDirection(azimuth, elevation);
  const box = new THREE.Box3().setFromPoints(points);
  const target = box.getCenter(new THREE.Vector3());
  const f = dir.clone().negate();
  const r = new THREE.Vector3().crossVectors(f, UP).normalize();
  const u = new THREE.Vector3().crossVectors(r, f).normalize();
  const ndc = new THREE.Vector3();
  let distance = 0;
  for (let i = 0; i < 3; i++) {
    distance = fitDistance(points, target, dir, camera, pad);
    camera.position.copy(target).addScaledVector(dir, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      ndc.copy(p).project(camera);
      minX = Math.min(minX, ndc.x);
      maxX = Math.max(maxX, ndc.x);
      minY = Math.min(minY, ndc.y);
      maxY = Math.max(maxY, ndc.y);
    }
    const halfH = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * camera.aspect;
    target.addScaledVector(r, ((minX + maxX) / 2) * halfW).addScaledVector(u, ((minY + maxY) / 2) * halfH);
  }
  distance = fitDistance(points, target, dir, camera, pad);
  if (azimuthSpan > 0) {
    for (const a of [azimuth - azimuthSpan, azimuth + azimuthSpan]) {
      distance = Math.max(distance, fitDistance(points, target, viewDirection(a, elevation), camera, pad));
    }
  }
  if (shiftY) {
    const halfH = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    target.addScaledVector(u, -shiftY * halfH * 2);
  }
  camera.position.copy(target).addScaledVector(dir, distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return { target, distance };
}

/** Extreme points of the house, deck, steps and chimney, for framing. */
export function housePoints(): THREE.Vector3[] {
  return FRAME_POINTS.map((p) => new THREE.Vector3(...p));
}
