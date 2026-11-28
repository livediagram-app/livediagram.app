'use client';

// Palette portraits (docs/specs/008-canvas/3d-engine.md "Palette portraits"): the avatar palette's pictures of your
// character, rendered from the scene's own game character (game-figure.ts) by ONE offscreen WebGL renderer, made on
// first use and let go when idle. Stills are queued and rendered a few a frame, kept as images in the store
// (lib/real-3d/figure-portrait.ts); the preview card's looping Behaviour is drawn frame by frame into its own 2D canvas.
// Loaded on demand (FigurePortrait imports it), so three.js stays out of the palette's own chunk.

import * as THREE from 'three';
import {
  reactionDuration,
  reactionPose,
  type AvatarReactionKind,
} from '@livehuddle/avatar/reactions';
import { gameLook, gameLookKey } from '@/lib/real-3d/game-look';
import {
  PORTRAIT_BUFFER_PX,
  PORTRAIT_FAILED,
  PORTRAIT_FIGURE_CAP,
  PORTRAIT_FOV_DEG,
  PORTRAIT_FRAME_BUDGET_MS,
  PORTRAIT_IDLE_RELEASE_MS,
  PORTRAIT_LOOP_REST_MS,
  PORTRAIT_SETTLE_DT,
  PORTRAIT_SETTLE_STEPS,
  facingYaw,
  liftInSpritePx,
  portraitCamera,
  portraitKey,
  portraitMove,
  portraitPack,
  portraitPixels,
  portraitRatio,
  portraitUrl,
  putPortrait,
  type PortraitRequest,
} from '@/lib/real-3d/figure-portrait';
import { GameFigure, gamePack, loadGamePack } from './game-figure';
import { behaviourStill } from '@/lib/avatar-palette';
import { easeGestures, gesturesOf, NO_GESTURES, poseGestures } from './figure-gestures';
import { wearStatus } from './status-props';
import { createLook, type Look } from './scene-look';

type Engine = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  holder: THREE.Group;
  camera: THREE.PerspectiveCamera;
  look: Look;
  lost: boolean;
};

let engine: Engine | null = null;
let broken = false;

/** The one renderer, made on first use; null when WebGL is not to be had. */
function getEngine(): Engine | null {
  if (engine && !engine.lost) return engine;
  if (broken || typeof document === 'undefined') return null;
  try {
    THREE.ColorManagement.enabled = false;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(PORTRAIT_BUFFER_PX, PORTRAIT_BUFFER_PX, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setScissorTest(true);
    // Canvas coordinates (y down), as the live scene's, so the sun and sky light a figure as they do in a Space. The
    // live view's projection mirrors canvas y on the screen; here the image is mirrored instead (copyOut), since a
    // mirrored parent would break the figure's posing (it reads its world turn) and the camera stays a plain one.
    const scene = new THREE.Scene();
    const look = createLook(scene, renderer);
    // A portrait has no floor to cast on: no shadow map, no catcher.
    renderer.shadowMap.enabled = false;
    look.sun.castShadow = false;
    look.catcher.visible = false;
    const holder = new THREE.Group();
    scene.add(holder);
    const camera = new THREE.PerspectiveCamera(PORTRAIT_FOV_DEG, 1, 1, 2000);
    camera.up.set(0, 0, 1);
    const e: Engine = { renderer, scene, holder, camera, look, lost: false };
    canvas.addEventListener('webglcontextlost', () => {
      e.lost = true;
    });
    engine = e;
    return e;
  } catch {
    broken = true;
    return null;
  }
}

function releaseEngine(): void {
  if (!engine) return;
  disposeFigures();
  engine.look.dispose();
  engine.renderer.dispose();
  engine.renderer.forceContextLoss();
  engine = null;
}

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let players = 0;
function touch(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (queue.size === 0 && players === 0) releaseEngine();
  }, PORTRAIT_IDLE_RELEASE_MS);
}

/** Aims the camera for a picture and renders the holder's figure into the buffer's bottom-left `w` x `h`. */
function renderInto(e: Engine, req: PortraitRequest, w: number, h: number): void {
  const cam = portraitCamera(req.crop, w / h);
  e.camera.position.set(...cam.position);
  e.camera.aspect = w / h;
  e.camera.updateProjectionMatrix();
  e.camera.lookAt(...cam.target);
  e.renderer.setViewport(0, 0, w, h);
  e.renderer.setScissor(0, 0, w, h);
  e.renderer.clear();
  e.renderer.render(e.scene, e.camera);
}

/** A dressed figure of the look, in the holder (null while its pack is not loaded). */
function figureFor(e: Engine, req: PortraitRequest): GameFigure | null {
  const g = gameLook(req.look);
  const pack = gamePack(g.pack);
  if (!pack) return null;
  const fig = new GameFigure(pack, g);
  e.holder.add(fig.object);
  return fig;
}

/**
 * The stills' figures, one per look (its game look's key), oldest out past the cap: dressing a figure clones the whole
 * pack, most of a picture's cost, so a flyout's next picture of the same look (another move, crop or size) only poses.
 */
const figures = new Map<string, GameFigure>();

function cachedFigure(e: Engine, req: PortraitRequest): GameFigure | null {
  const g = gameLook(req.look);
  const key = gameLookKey(g);
  let fig = figures.get(key);
  if (fig) figures.delete(key);
  else {
    const pack = gamePack(g.pack);
    if (!pack) return null;
    fig = new GameFigure(pack, g);
    while (figures.size >= PORTRAIT_FIGURE_CAP) {
      const [oldest, old] = figures.entries().next().value as [string, GameFigure];
      figures.delete(oldest);
      old.dispose();
    }
  }
  figures.set(key, fig);
  e.holder.add(fig.object);
  return fig;
}

function disposeFigures(): void {
  for (const fig of figures.values()) fig.dispose();
  figures.clear();
}

/**
 * Copies the buffer's bottom-left `w` x `h` (WebGL's origin) into a 2D context at its top-left, mirrored left to
 * right as the live view's projection mirrors the canvas's y (so a wave is the same hand as in the Space).
 */
function copyOut(e: Engine, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(-1, 0, 0, 1, w, 0);
  ctx.drawImage(e.renderer.domElement, 0, PORTRAIT_BUFFER_PX - h, w, h, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Renders one still into the store. Answers false when it has to wait (its pack is loading). */
function renderStill(e: Engine, key: string, req: PortraitRequest): boolean {
  const fig = cachedFigure(e, req);
  if (!fig) return false;
  const m = portraitMove(req.move);
  e.holder.rotation.set(0, 0, m.yaw);
  e.holder.position.set(0, 0, 0);
  // A status's signature (the preview card's), and the newer Behaviours' arms (figure-gestures.ts).
  const kind = wearStatus(fig, req.status ?? null);
  const still = req.move ? behaviourStill(req.move) : null;
  const carrying = !still && (kind === 'sandwich' || kind === 'bottle');
  for (let i = 0; i < PORTRAIT_SETTLE_STEPS; i++)
    fig.update(PORTRAIT_SETTLE_DT, 0, {
      seated: false,
      waving: m.waving,
      armsUp: m.armsUp,
      armsOut: m.armsOut,
      legsApart: m.legsApart,
      ...(carrying ? { holding: true } : null),
      seatHeight: 0,
    });
  poseGestures(fig, gesturesOf(still, !still && kind === 'phone'));
  const { w, h } = portraitPixels(req, portraitRatio(window.devicePixelRatio));
  renderInto(e, req, w, h);
  // The buffer's picture is taken now as a GPU copy; reading it back, mirroring and encoding it happen later, off this
  // frame's budget.
  pending.add(key);
  const done = (url: string) => {
    pending.delete(key);
    putPortrait(key, url);
  };
  createImageBitmap(e.renderer.domElement, 0, PORTRAIT_BUFFER_PX - h, w, h).then(
    (bitmap) => {
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');
      if (ctx) {
        ctx.setTransform(-1, 0, 0, 1, w, 0);
        ctx.drawImage(bitmap, 0, 0);
      }
      bitmap.close();
      out.toBlob((blob) => done(blob ? URL.createObjectURL(blob) : PORTRAIT_FAILED), 'image/png');
    },
    () => done(PORTRAIT_FAILED),
  );
  // The figure stays dressed for the next picture of its look; only out of the holder, so it stands alone.
  e.holder.remove(fig.object);
  return true;
}

const queue = new Map<string, PortraitRequest>();
const pending = new Set<string>();
const loadingPacks = new Set<string>();
let pumping = 0;
/** The last picture's time, to judge whether another fits this frame. */
let lastMs = 0;

/** The last pump's timings, for the performance probe: pictures drawn and ms spent. */
export const portraitStats = { drawn: 0, ms: 0, worstMs: 0, frames: 0 };

function failAll(): void {
  for (const key of queue.keys()) putPortrait(key, PORTRAIT_FAILED);
  queue.clear();
}

function pump(): void {
  pumping = 0;
  const e = getEngine();
  if (!e) {
    failAll();
    return;
  }
  const start = performance.now();
  let drawn = 0;
  for (const [key, req] of queue) {
    // One picture a frame at least; another only while one more (at the last one's time) still fits the budget.
    if (drawn > 0 && performance.now() - start + lastMs > PORTRAIT_FRAME_BUDGET_MS) break;
    const pack = portraitPack(req);
    if (!gamePack(pack)) {
      // Loads once; the queue is pumped again when it is in (or fails it).
      if (!loadingPacks.has(pack)) {
        loadingPacks.add(pack);
        void loadGamePack(pack).then(() => {
          loadingPacks.delete(pack);
          if (!gamePack(pack))
            for (const [k, r] of queue)
              if (portraitPack(r) === pack) {
                queue.delete(k);
                putPortrait(k, PORTRAIT_FAILED);
              }
          schedule();
        });
      }
      continue;
    }
    queue.delete(key);
    const t0 = performance.now();
    try {
      renderStill(e, key, req);
    } catch {
      putPortrait(key, PORTRAIT_FAILED);
    }
    const t1 = performance.now();
    const ms = t1 - t0;
    lastMs = ms;
    drawn += 1;
    // One user timing a picture, for the performance probe (docs/specs/008-canvas/3d-engine.md "Palette portraits").
    performance.measure?.('livehuddle:portrait', { start: t0, end: t1 });
    portraitStats.drawn += 1;
    portraitStats.ms += ms;
    portraitStats.worstMs = Math.max(portraitStats.worstMs, ms);
  }
  portraitStats.frames += 1;
  performance.measure?.('livehuddle:portrait-frame', { start, end: performance.now() });
  if (e.lost) {
    engine = null;
    failAll();
    return;
  }
  // Whatever is left waits for the next frame, unless all of it waits on a pack.
  if ([...queue.values()].some((r) => gamePack(portraitPack(r)))) schedule();
  touch();
}

function schedule(): void {
  if (pumping || queue.size === 0) return;
  pumping = requestAnimationFrame(pump);
}

/** Asks for a still; it lands in the store (portraitUrl) when drawn. Asking again for one queued or drawn is free. */
export function requestPortrait(req: PortraitRequest): void {
  const key = portraitKey(req, portraitRatio(window.devicePixelRatio));
  if (portraitUrl(key) !== undefined || pending.has(key) || queue.has(key)) return;
  queue.set(key, req);
  schedule();
}

/**
 * Plays a Behaviour on a loop into `canvas` (sized here to the request in device px), from the same reactionPose the
 * canvas plays. Answers the stop; `onFail` is called when it cannot be drawn.
 */
export function playPortrait(
  canvas: HTMLCanvasElement,
  req: PortraitRequest,
  move: AvatarReactionKind,
  onFail: () => void,
): () => void {
  const { w, h } = portraitPixels(req, portraitRatio(window.devicePixelRatio));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  players += 1;
  let raf = 0;
  let fig: GameFigure | null = null;
  let stopped = false;
  const period = reactionDuration(move) + PORTRAIT_LOOP_REST_MS;
  const start = performance.now();
  let last = start;
  let gestures = NO_GESTURES;
  const frame = (now: number) => {
    if (stopped) return;
    const e = getEngine();
    if (!e || !ctx) {
      onFail();
      return;
    }
    if (!fig) {
      fig = figureFor(e, req);
      if (!fig) {
        // Its pack is loading: try again when it is in.
        void loadGamePack(portraitPack(req)).then(() => {
          if (stopped) return;
          if (!gamePack(portraitPack(req))) onFail();
          else raf = requestAnimationFrame(frame);
        });
        return;
      }
    } else e.holder.add(fig.object);
    wearStatus(fig, req.status ?? null);
    const p = reactionPose(move, (now - start) % period);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const on = !p.done;
    fig.update(dt, 0, {
      seated: false,
      waving: on && p.waveArm,
      armsUp: on && p.armsUp,
      armsOut: on && p.armsOut,
      legsApart: on && p.legsApart,
      seatHeight: 0,
    });
    gestures = easeGestures(gestures, gesturesOf(on ? p : null, false), dt);
    poseGestures(fig, gestures);
    e.holder.rotation.set(0, 0, facingYaw(on ? p.facing : undefined));
    e.holder.position.set(0, 0, on ? liftInSpritePx(p.lift) : 0);
    renderInto(e, req, w, h);
    copyOut(e, ctx, w, h);
    // The figure leaves the holder between frames, so a still drawn meanwhile stands alone.
    e.holder.remove(fig.object);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    players -= 1;
    if (fig) {
      fig.object.parent?.remove(fig.object);
      fig.dispose();
    }
    touch();
  };
}
