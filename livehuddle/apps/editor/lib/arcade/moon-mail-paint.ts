// Moon Mail on a canvas (docs/specs/009-elements/social-pieces.md "Moon Mail", "Reduced motion"; blueprint "The
// drawing"): one call paints one frame of a run, read straight from the model's run object, so the panel's loop
// hands it the run and the time and React never hears of a frame.
//
// Every call draws in play units: the canvas is scaled so the square is 0 to 1 each way, as the model's numbers are.
// The sky (stars, moon, orbits) never changes, so it is painted once per size into a layer and copied each frame.
// The moments (a letter's ring and points, a hit's red edge) live in fixed slots, so a frame allocates nothing.

import { MOON_R, ORBITS, ROCK_LIFE_MS, type MoonMailItem, type MoonMailRun } from './moon-mail';

/** How long a hop's glide between orbits takes on screen (full motion only). */
export const HOP_GLIDE_MS = 120;
/** A letter pops in over this long. */
const LETTER_POP_MS = 180;
/** A rock fades over the end of its life. */
const ROCK_FADE_MS = 600;
/** A letter's ring and points, and a hit's red edge. */
const LETTER_MOMENT_MS = 600;
const HIT_MOMENT_MS = 300;
/** A hurt ship blinks this often; under reduced motion it is drawn this dim instead. */
const HURT_BLINK_MS = 100;
const HURT_DIM = 0.45;

const TAU = Math.PI * 2;

/** The colours, each named for what it paints. */
export const MOON_MAIL_COLORS = {
  skyInner: '#18214f',
  skyOuter: '#060a1c',
  star: '#ffffff',
  orbit: 'rgba(148, 163, 184, 0.38)',
  orbitHere: 'rgba(253, 230, 138, 0.42)',
  moonLight: '#e2e8f0',
  moonDark: '#64748b',
  crater: 'rgba(71, 85, 105, 0.5)',
  moonRim: 'rgba(226, 232, 240, 0.18)',
  envelope: '#f8fafc',
  envelopeEdge: '#94a3b8',
  seal: '#ef4444',
  rock: '#8a7f76',
  rockEdge: '#4b423c',
  rockShade: 'rgba(30, 24, 20, 0.35)',
  ship: '#fb7185',
  shipFin: '#e11d48',
  porthole: '#e0f2fe',
  flame: '#fbbf24',
  flameCore: '#fff7ed',
  letterRing: '#fcd34d',
  hit: 'rgba(239, 68, 68, 0.55)',
} as const;

// A fixed starfield, the same on every screen: mulberry32 from a constant seed, never inside the moon.
type Star = { x: number; y: number; r: number; a: number; twinkle: boolean };
const STARS: readonly Star[] = (() => {
  let seed = 0x5eed;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const out: Star[] = [];
  while (out.length < 48) {
    const x = rnd();
    const y = rnd();
    const r = 0.0018 + rnd() * 0.0032;
    const a = 0.35 + rnd() * 0.6;
    if (Math.hypot(x - 0.5, y - 0.5) < MOON_R + 0.03) continue;
    out.push({ x, y, r, a, twinkle: out.length % 8 === 0 });
  }
  return out;
})();

// Three rock outlines (unit radius), picked by a rock's speed so each keeps its own.
const ROCK_SHAPES: readonly (readonly number[])[] = [
  [1, 0.78, 0.95, 0.7, 1, 0.82, 0.9],
  [0.85, 1, 0.72, 0.92, 0.8, 1, 0.74],
  [1, 0.9, 0.7, 1, 0.86, 0.68, 0.95],
];
const ROCK_R = 0.03;
/** The ship's drawing is in its own units, this much larger on the screen. */
const SHIP_SCALE = 1.35;

/** A layer to cache the sky in: an offscreen canvas of `px` square. */
export type SkyLayer = { source: CanvasImageSource; ctx: CanvasRenderingContext2D };
export type MakeSkyLayer = (px: number) => SkyLayer | null;

/** A layer canvas from the page's document, or none (the sky is then painted each frame). */
export const documentSkyLayer: MakeSkyLayer = (px) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  return ctx ? { source: canvas, ctx } : null;
};

export type PaintFrame = {
  /** The page's clock (performance.now), for the decorative motion and the moments. */
  now: number;
  /** The canvas's backing size, in device pixels, square. */
  px: number;
  reduced: boolean;
};

type Moment = { kind: 'letter' | 'hit' | 'none'; at: number; x: number; y: number; points: number };

// A point on a circle round the moon, one axis at a time (no tuple per call).
const ox = (radius: number, angle: number) => 0.5 + Math.cos(angle) * radius;
const oy = (radius: number, angle: number) => 0.5 + Math.sin(angle) * radius;

export function createMoonMailPainter(makeLayer: MakeSkyLayer = documentSkyLayer) {
  let sky: SkyLayer | null = null;
  let skyPx = 0;
  // What the run's counters read last frame: a rise is a moment.
  let seenRun: MoonMailRun | null = null;
  let seenLetters = 0;
  let seenHits = 0;
  let seenScore = 0;
  // The hop's glide: the radius drawn as the orbit changed, and the orbit it changed to.
  let glideFrom: number = ORBITS[1];
  let glideOrbit = 1;
  let shownR: number = ORBITS[1];
  const moments: Moment[] = Array.from({ length: 4 }, () => ({
    kind: 'none',
    at: 0,
    x: 0,
    y: 0,
    points: 0,
  }));
  let nextMoment = 0;

  const addMoment = (kind: 'letter' | 'hit', at: number, x: number, y: number, points: number) => {
    const m = moments[nextMoment]!;
    nextMoment = (nextMoment + 1) % moments.length;
    m.kind = kind;
    m.at = at;
    m.x = x;
    m.y = y;
    m.points = points;
  };

  function skyFor(px: number): SkyLayer | null {
    if (sky && skyPx === px) return sky;
    sky = makeLayer(px);
    skyPx = px;
    if (sky) {
      sky.ctx.setTransform(px, 0, 0, px, 0, 0);
      paintSky(sky.ctx);
    }
    return sky;
  }

  function follow(run: MoonMailRun, frame: PaintFrame) {
    if (seenRun !== run) {
      seenRun = run;
      seenLetters = run.letters;
      seenHits = run.hits;
      seenScore = run.score;
      glideOrbit = run.orbit;
      glideFrom = ORBITS[run.orbit]!;
      shownR = glideFrom;
      for (const m of moments) m.kind = 'none';
    }
    if (run.orbit !== glideOrbit) {
      glideFrom = shownR;
      glideOrbit = run.orbit;
    }
    const target = ORBITS[run.orbit]!;
    const t = frame.reduced ? 1 : Math.min(1, Math.max(0, (run.ms - run.hopAt) / HOP_GLIDE_MS));
    // Ease out: quick off the mark, settling onto the orbit.
    shownR = glideFrom + (target - glideFrom) * (1 - (1 - t) * (1 - t));
    if (run.letters > seenLetters || run.hits > seenHits) {
      const x = ox(shownR, run.angle);
      const y = oy(shownR, run.angle);
      if (!frame.reduced) {
        if (run.letters > seenLetters) addMoment('letter', frame.now, x, y, run.score - seenScore);
        if (run.hits > seenHits) addMoment('hit', frame.now, x, y, 0);
      }
    }
    seenLetters = run.letters;
    seenHits = run.hits;
    seenScore = run.score;
  }

  /** Paint one frame of `run`. */
  function paint(ctx: CanvasRenderingContext2D, run: MoonMailRun, frame: PaintFrame): void {
    const { px, now, reduced } = frame;
    follow(run, frame);
    ctx.setTransform(px, 0, 0, px, 0, 0);
    const layer = skyFor(px);
    if (layer) ctx.drawImage(layer.source, 0, 0, 1, 1);
    else paintSky(ctx);
    if (!reduced) paintTwinkle(ctx, now);

    // The ship's orbit, traced brighter.
    ctx.strokeStyle = MOON_MAIL_COLORS.orbitHere;
    ctx.lineWidth = 0.004;
    ctx.setLineDash([0.008, 0.012]);
    ctx.beginPath();
    ctx.arc(0.5, 0.5, ORBITS[run.orbit]!, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const it of run.items) {
      if (it.kind === 'letter') paintLetter(ctx, it, reduced);
      else paintRock(ctx, it, reduced);
    }

    const hurt = run.ms < run.hurtUntil && !run.over;
    const alpha = !hurt
      ? 1
      : reduced
        ? HURT_DIM
        : Math.floor(run.ms / HURT_BLINK_MS) % 2 === 0
          ? 0.25
          : 1;
    const sx = ox(shownR, run.angle);
    const sy = oy(shownR, run.angle);
    paintShip(
      ctx,
      px,
      sx,
      sy,
      run.angle + Math.PI / 2,
      alpha,
      reduced ? 0.5 : (Math.sin(now / 45) + 1) / 2,
    );

    if (!reduced) paintMoments(ctx, now, px);
    ctx.globalAlpha = 1;
  }

  return { paint };

  function paintMoments(ctx: CanvasRenderingContext2D, now: number, px: number) {
    for (const m of moments) {
      if (m.kind === 'none') continue;
      const span = m.kind === 'letter' ? LETTER_MOMENT_MS : HIT_MOMENT_MS;
      const p = (now - m.at) / span;
      if (p >= 1 || p < 0) {
        m.kind = 'none';
        continue;
      }
      if (m.kind === 'hit') {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = MOON_MAIL_COLORS.hit;
        ctx.lineWidth = 0.05;
        ctx.strokeRect(0, 0, 1, 1);
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = MOON_MAIL_COLORS.letterRing;
      ctx.lineWidth = 0.005;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 0.018 + 0.05 * p, 0, TAU);
      ctx.stroke();
      // The points in device pixels, so the type is crisp at any size.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = MOON_MAIL_COLORS.letterRing;
      ctx.font = `700 ${Math.round(px * 0.045)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`+${m.points}`, m.x * px, (m.y - 0.045 - 0.04 * p) * px);
      ctx.setTransform(px, 0, 0, px, 0, 0);
      ctx.globalAlpha = 1;
    }
  }
}

/** The still sky: the night, the stars, the moon and the three dotted orbits. */
export function paintSky(ctx: CanvasRenderingContext2D): void {
  const c = MOON_MAIL_COLORS;
  const night = ctx.createRadialGradient(0.5, 0.42, 0.05, 0.5, 0.5, 0.75);
  night.addColorStop(0, c.skyInner);
  night.addColorStop(1, c.skyOuter);
  ctx.fillStyle = night;
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = c.star;
  for (const s of STARS) {
    ctx.globalAlpha = s.a;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = c.orbit;
  ctx.lineWidth = 0.003;
  ctx.setLineDash([0.006, 0.014]);
  for (const r of ORBITS) {
    ctx.beginPath();
    ctx.arc(0.5, 0.5, r, 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // A soft rim of light round the moon, then the moon lit from the top left, then its craters.
  ctx.fillStyle = c.moonRim;
  ctx.beginPath();
  ctx.arc(0.5, 0.5, MOON_R + 0.012, 0, TAU);
  ctx.fill();
  const moon = ctx.createRadialGradient(0.47, 0.465, 0.01, 0.5, 0.5, MOON_R);
  moon.addColorStop(0, c.moonLight);
  moon.addColorStop(1, c.moonDark);
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(0.5, 0.5, MOON_R, 0, TAU);
  ctx.fill();
  ctx.fillStyle = c.crater;
  for (const [x, y, r] of [
    [0.468, 0.478, 0.022],
    [0.533, 0.54, 0.017],
    [0.53, 0.462, 0.01],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

// A few stars breathe slowly (full motion only).
function paintTwinkle(ctx: CanvasRenderingContext2D, now: number) {
  ctx.fillStyle = MOON_MAIL_COLORS.star;
  let i = 0;
  for (const s of STARS) {
    if (!s.twinkle) continue;
    i += 1;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 700 + i * 1.7);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function paintLetter(ctx: CanvasRenderingContext2D, it: MoonMailItem, reduced: boolean) {
  const c = MOON_MAIL_COLORS;
  const x = ox(ORBITS[it.orbit]!, it.angle);
  const y = oy(ORBITS[it.orbit]!, it.angle);
  const t = reduced ? 1 : Math.min(1, it.age / LETTER_POP_MS);
  // Back-out: a touch past full size, then settling.
  // Its curve is 0 at the start and can dip a hair under it in floating point: a canvas throws on a negative
  // radius, so a letter too small to see is not drawn at all.
  const k = t >= 1 ? 1 : 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
  if (k <= 0.01) return;
  const w = 0.05 * k;
  const h = 0.034 * k;
  ctx.fillStyle = c.envelope;
  ctx.strokeStyle = c.envelopeEdge;
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x, y + h * 0.08);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.stroke();
  ctx.fillStyle = c.seal;
  ctx.beginPath();
  ctx.arc(x, y + h * 0.08, 0.0055 * k, 0, TAU);
  ctx.fill();
}

function paintRock(ctx: CanvasRenderingContext2D, it: MoonMailItem, reduced: boolean) {
  const c = MOON_MAIL_COLORS;
  const x = ox(ORBITS[it.orbit]!, it.angle);
  const y = oy(ORBITS[it.orbit]!, it.angle);
  const fade = Math.min(1, Math.max(0, (ROCK_LIFE_MS - it.age) / ROCK_FADE_MS));
  if (fade <= 0) return;
  const shape = ROCK_SHAPES[Math.floor(it.speed * 100) % ROCK_SHAPES.length]!;
  const spin = reduced ? 0 : -it.age * 0.0012 * it.speed;
  ctx.globalAlpha = fade;
  ctx.fillStyle = c.rock;
  ctx.strokeStyle = c.rockEdge;
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  for (let i = 0; i < shape.length; i += 1) {
    const a = spin + (i / shape.length) * TAU;
    const r = ROCK_R * shape[i]!;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // A shaded dent, so it reads as a lump and not a blot.
  ctx.fillStyle = c.rockShade;
  ctx.beginPath();
  ctx.arc(
    x + Math.cos(spin + 1) * ROCK_R * 0.35,
    y + Math.sin(spin + 1) * ROCK_R * 0.35,
    ROCK_R * 0.28,
    0,
    TAU,
  );
  ctx.fill();
  ctx.globalAlpha = 1;
}

// The mail ship: a little rocket along its path, its nose ahead, a porthole and a flame behind (`flicker` 0 to 1).
// Drawn in the ship's own frame (+x its nose) by one setTransform, rather than save / rotate / restore.
function paintShip(
  ctx: CanvasRenderingContext2D,
  px: number,
  x: number,
  y: number,
  heading: number,
  alpha: number,
  flicker: number,
) {
  const c = MOON_MAIL_COLORS;
  const cos = Math.cos(heading) * px * SHIP_SCALE;
  const sin = Math.sin(heading) * px * SHIP_SCALE;
  ctx.setTransform(cos, sin, -sin, cos, x * px, y * px);
  ctx.globalAlpha = alpha;
  // The flame, longer as it flickers.
  const flame = 0.016 + 0.01 * flicker;
  ctx.fillStyle = c.flame;
  ctx.beginPath();
  ctx.moveTo(-0.018, -0.008);
  ctx.lineTo(-0.018 - flame, 0);
  ctx.lineTo(-0.018, 0.008);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.flameCore;
  ctx.beginPath();
  ctx.moveTo(-0.018, -0.004);
  ctx.lineTo(-0.018 - flame * 0.55, 0);
  ctx.lineTo(-0.018, 0.004);
  ctx.closePath();
  ctx.fill();
  // The fins.
  ctx.fillStyle = c.shipFin;
  ctx.beginPath();
  ctx.moveTo(-0.004, -0.01);
  ctx.lineTo(-0.02, -0.02);
  ctx.lineTo(-0.017, -0.006);
  ctx.closePath();
  ctx.moveTo(-0.004, 0.01);
  ctx.lineTo(-0.02, 0.02);
  ctx.lineTo(-0.017, 0.006);
  ctx.closePath();
  ctx.fill();
  // The body: a rounded hull to a pointed nose.
  ctx.fillStyle = c.ship;
  ctx.beginPath();
  ctx.moveTo(0.03, 0);
  ctx.quadraticCurveTo(0.016, -0.014, -0.018, -0.01);
  ctx.lineTo(-0.018, 0.01);
  ctx.quadraticCurveTo(0.016, 0.014, 0.03, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.porthole;
  ctx.beginPath();
  ctx.arc(0.008, 0, 0.0055, 0, TAU);
  ctx.fill();
  ctx.setTransform(px, 0, 0, px, 0, 0);
  ctx.globalAlpha = 1;
}
