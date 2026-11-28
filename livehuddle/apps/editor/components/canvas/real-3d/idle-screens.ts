'use client';

// Idle Screens show the liveworkspace logo (docs/specs/009-elements/screen-and-room-sign.md "The idle face", 3d-engine.md
// "An idle Screen shows the logo"): each Screen with nothing chosen gets a quad on its glass (the place its model
// marks, scene-pieces.ts `screenFaces`), all of them one mesh on one shared canvas texture. The texture is the logo
// drawn from @liveworkspace/brand's own geometry (the prism opening and turning as the header logo does on hover,
// idle-screen-logo.ts), redrawn at most IDLE_LOGO_FPS times a second, only while the prism moves and an idle Screen is
// in view, so twenty idle Screens cost one draw call and one texture upload.

import * as THREE from 'three';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { BRAND_GRADIENTS, prismFrame, prismPalette, type PrismPalette } from '@livehuddle/ui/brand';
import {
  containUvs,
  IDLE_LOGO_FPS,
  idleLogoPose,
  idleLogoResting,
  type LogoPose,
} from '@/lib/real-3d/idle-screen-logo';
import { placeAspect } from './poster-pictures';

/** The texture's size, in px: 16 by 9, as the Screen's panel. */
export const IDLE_LOGO_TEXTURE = { width: 768, height: 432 } as const;
/** The glass behind the logo (the model's own glass, models/first.ts) and the glow about it. */
const GLASS = '#1a2436';
const GLOW = 'rgba(148, 163, 184, 0.30)';
const FONT = "600 50px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
// The wordmark's two tones on dark glass, as WorkspaceWordmark sets them in dark mode (slate-400, slate-100).
const LIVE_INK = '#94a3b8';
const WORD_INK = '#f1f5f9';
// The prism's scale (artwork units to texture px) and where its middle sits.
const K = 0.62;
const PRISM_CY = IDLE_LOGO_TEXTURE.height * 0.4;
// The prism's layer: room for it open and turned (its artwork reaches about ±180 across, -190 to 130 down).
const LAYER = { width: Math.ceil(400 * K), height: Math.ceil(360 * K), ox: 200, oy: 205 } as const;

type Gradient = (typeof BRAND_GRADIENTS)[number];
const GRADIENT = new Map(BRAND_GRADIENTS.map((g) => [g.key, g] as const));

// A path's box, read from its "M x y L x y ... Z" points.
function pathBox(d: string): { x0: number; y0: number; x1: number; y1: number } {
  const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) {
    x0 = Math.min(x0, n[i]!);
    x1 = Math.max(x1, n[i]!);
    y0 = Math.min(y0, n[i + 1]!);
    y1 = Math.max(y1, n[i + 1]!);
  }
  return { x0, y0, x1, y1 };
}

// A face's gradient over its own box, as SVG's objectBoundingBox lays it.
function faceFill(
  ctx: CanvasRenderingContext2D,
  d: string,
  g: Gradient,
  palette: PrismPalette,
): CanvasGradient {
  const b = pathBox(d);
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  const v = g.vector;
  const grad = ctx.createLinearGradient(
    b.x0 + (w * v.x1) / 100,
    b.y0 + (h * v.y1) / 100,
    b.x0 + (w * v.x2) / 100,
    b.y0 + (h * v.y2) / 100,
  );
  for (const [stop, offset, opacity] of g.stops) {
    const hex = palette[stop];
    const r = parseInt(hex.slice(1, 3), 16);
    const gr = parseInt(hex.slice(3, 5), 16);
    const bl = parseInt(hex.slice(5, 7), 16);
    grad.addColorStop(offset / 100, `rgba(${r},${gr},${bl},${opacity})`);
  }
  return grad;
}

/** Draws the prism at `pose` into `ctx` (its layer, cleared first), as BrandMark draws it in dark mode. */
export function drawPrism(ctx: CanvasRenderingContext2D, pose: LogoPose, palette: PrismPalette) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(K, 0, 0, K, LAYER.ox * K, LAYER.oy * K);
  const frame = prismFrame(pose);
  const fill = (d: string, key: Gradient['key'], alpha: number, blend: boolean) => {
    if (!d || alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = blend ? 'screen' : 'source-over';
    ctx.fillStyle = faceFill(ctx, d, GRADIENT.get(key)!, palette);
    ctx.fill(new Path2D(d));
  };
  // Back to front, as the artwork: the lid, each side's right-lit layer, each side's left-lit layer, the bottom fold.
  fill(frame.top, 'backTop', 1, false);
  for (const s of frame.sides) fill(s.d, 'backRight', s.right, true);
  for (const s of frame.sides) fill(s.d, 'frontLeft', s.left, false);
  fill(frame.bottom, 'frontBottom', 1, true);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// The still part: the glass, a soft glow behind the prism, the wordmark and the glass's sheen. Its edge is the plain
// glass colour, which a quad wider or taller than 16 by 9 stretches out to its sides.
function drawBackdrop(ctx: CanvasRenderingContext2D) {
  const { width: W, height: H } = IDLE_LOGO_TEXTURE;
  ctx.fillStyle = GLASS;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, PRISM_CY, 0, W / 2, PRISM_CY, H * 0.42);
  glow.addColorStop(0, GLOW);
  glow.addColorStop(1, 'rgba(148, 163, 184, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  const live = ctx.measureText('live').width;
  const word = ctx.measureText('workspace').width;
  // Tracked a little tight, as the logo's text is.
  const x = (W - live - word) / 2;
  const y = H * 0.82;
  ctx.fillStyle = LIVE_INK;
  ctx.fillText('live', x, y);
  ctx.fillStyle = WORD_INK;
  ctx.fillText('workspace', x + live, y);
}

/** One idle Screen's glass place: twelve numbers, bottom left, bottom right, top right, top left. */
export type IdleScreenPlaces = ReadonlyMap<string, readonly number[]>;

export type IdleScreens = {
  object: THREE.Mesh;
  /** Every idle Screen on the board now (the pieces were built). */
  set: (places: IdleScreenPlaces) => void;
  /** Moves the given Screens' quads (a drag in progress). */
  move: (places: IdleScreenPlaces) => void;
  /** Hides these Screens' quads (their wall is cut down) and shows every other one. */
  hide: (ids: ReadonlySet<string>) => void;
  /** Redraws the logo when it is due, moving and in view. `now` in ms; `clip` the camera's world-to-clip matrix. */
  tick: (now: number, clip: THREE.Matrix4) => void;
  /** How many quads are drawn now (for tests). */
  count: () => number;
  dispose: () => void;
};

/** What a redraw cost, for the perf probe (dev builds only): draws so far and their total ms. */
type IdleLogoCost = { draws: number; ms: number };

export function createIdleScreens(
  opts: { reduced?: () => boolean; canvas?: () => HTMLCanvasElement } = {},
): IdleScreens {
  const makeCanvas = opts.canvas ?? (() => document.createElement('canvas'));
  const reduced =
    opts.reduced ??
    (() =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const canvas = makeCanvas();
  canvas.width = IDLE_LOGO_TEXTURE.width;
  canvas.height = IDLE_LOGO_TEXTURE.height;
  const ctx = canvas.getContext('2d');
  // The still part, drawn once; the prism's own small layer, drawn each redraw.
  const backdrop = makeCanvas();
  backdrop.width = canvas.width;
  backdrop.height = canvas.height;
  const layer = makeCanvas();
  layer.width = LAYER.width;
  layer.height = LAYER.height;
  const bctx = backdrop.getContext('2d');
  const lctx = layer.getContext('2d');
  if (bctx) drawBackdrop(bctx);
  const palette = prismPalette('livediagram', 'dark', PLATFORM_SITE.accent);
  const texture = new THREE.CanvasTexture(canvas);
  // The renderer draws colours as given (Real3DLayer: no colour management), so the logo's are too.
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const geometry = new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;

  const places = new Map<string, readonly number[]>();
  let hidden: ReadonlySet<string> = new Set();
  // Each drawn quad's middle and reach, for the in-view test.
  let spheres: THREE.Sphere[] = [];
  let drawnAt = -Infinity;
  let drawnPose = '';
  const epoch = typeof performance !== 'undefined' ? performance.now() : 0;
  const frustum = new THREE.Frustum();
  const texAspect = IDLE_LOGO_TEXTURE.width / IDLE_LOGO_TEXTURE.height;

  const rebuild = () => {
    const shown = [...places].filter(([id, c]) => !hidden.has(id) && c.length === 12);
    mesh.visible = shown.length > 0;
    const pos = new Float32Array(shown.length * 12);
    const uv = new Float32Array(shown.length * 8);
    const index: number[] = [];
    spheres = [];
    shown.forEach(([, c], i) => {
      pos.set(c, i * 12);
      uv.set(containUvs(texAspect, placeAspect(c)), i * 8);
      const b = i * 4;
      index.push(b, b + 1, b + 2, b, b + 2, b + 3);
      const mid = new THREE.Vector3((c[0]! + c[6]!) / 2, (c[1]! + c[7]!) / 2, (c[2]! + c[8]!) / 2);
      spheres.push(
        new THREE.Sphere(mid, Math.hypot(c[6]! - c[0]!, c[7]! - c[1]!, c[8]! - c[2]!) / 2),
      );
    });
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
  };

  const draw = (pose: LogoPose) => {
    if (!ctx || !lctx) return;
    const t0 = performance.now();
    ctx.drawImage(backdrop, 0, 0);
    drawPrism(lctx, pose, palette);
    ctx.drawImage(
      layer,
      IDLE_LOGO_TEXTURE.width / 2 - LAYER.ox * K,
      PRISM_CY - (LAYER.oy - 25) * K,
    );
    texture.needsUpdate = true;
    if (process.env.NODE_ENV !== 'production') {
      const g = globalThis as { __idleScreenLogo?: IdleLogoCost };
      const cost = (g.__idleScreenLogo ??= { draws: 0, ms: 0 });
      cost.draws += 1;
      cost.ms += performance.now() - t0;
    }
  };

  return {
    object: mesh,
    set(next) {
      places.clear();
      for (const [id, c] of next) places.set(id, c);
      rebuild();
    },
    move(next) {
      let changed = false;
      for (const [id, c] of next)
        if (places.has(id)) {
          places.set(id, c);
          changed = true;
        }
      if (changed) rebuild();
    },
    hide(ids) {
      hidden = ids;
      rebuild();
    },
    tick(now, clip) {
      if (!mesh.visible) return;
      const still = reduced();
      const at = now - epoch;
      const pose = idleLogoPose(at, still);
      const key = `${pose.turn.toFixed(2)},${pose.open.toFixed(3)}`;
      // Nothing to draw: the prism stands as it was drawn (its rest, or the still logo).
      if (key === drawnPose && (still || idleLogoResting(at))) return;
      if (now - drawnAt < 1000 / IDLE_LOGO_FPS - 2 && drawnPose !== '') return;
      // Drawn once whatever is in view, so a Screen turned to never shows blank glass; after that only in view.
      if (drawnPose !== '') {
        frustum.setFromProjectionMatrix(clip);
        if (!spheres.some((s) => frustum.intersectsSphere(s))) return;
      }
      drawnAt = now;
      drawnPose = key;
      draw(pose);
    },
    count: () => (mesh.visible ? spheres.length : 0),
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
