// The particle engine behind a Reaction Pad burst (spec/135).
//
// Pure data and pure functions: spawning takes a random source and returns
// plain particles, stepping is a fixed transform of particle + dt, and drawing
// is the only part that touches a canvas. That split is what makes the physics
// testable without a DOM, and it is why the numbers below can be tuned with
// confidence rather than by poking at a running page.
//
// This replaced a dozen emoji spans on a single CSS keyframe. That version had
// no velocity, no gravity, no drag and no per-particle life, so every burst
// travelled the same straight line at the same speed and the whole effect read
// as clip-art being slid across the screen. Real spectacle needs particles that
// disagree with each other: different launch speeds, different masses, tumble,
// and an end that arrives at different times.

/** What a particle is drawn as. Each has its own path in `drawParticle`. */
export type ParticleKind = 'ribbon' | 'star' | 'heart' | 'dot' | 'ring' | 'spark';

export type Particle = {
  /** Position in canvas px, from the burst origin. */
  x: number;
  y: number;
  /** Velocity, px per second. */
  vx: number;
  vy: number;
  /** Rotation in radians, and its rate. */
  rot: number;
  spin: number;
  /** Half-extent in px. A ribbon uses it as half-length. */
  size: number;
  color: string;
  /** Seconds lived, and total lifespan. Alpha is derived from the ratio. */
  age: number;
  life: number;
  kind: ParticleKind;
  /** px/s². Positive falls. */
  gravity: number;
  /** Fraction of velocity kept per second. 1 = no air resistance. */
  drag: number;
  /**
   * Tumble phase for a ribbon, in radians. Drives the width squash that makes
   * a flat rectangle read as a piece of paper turning over in the air, which
   * is the single detail that separates confetti from falling blocks.
   */
  flutter: number;
  flutterRate: number;
  /** Sideways sway amplitude in px/s, for things that drift rather than fly. */
  sway: number;
  swayRate: number;
};

export const REACTION_PALETTE: Record<string, readonly string[]> = {
  // Party colours, deliberately saturated and various: confetti that is all
  // one hue reads as debris.
  confetti: [
    '#ef4444',
    '#f97316',
    '#facc15',
    '#22c55e',
    '#38bdf8',
    '#a855f7',
    '#ec4899',
    '#ffffff',
  ],
  // Warm metal, plus white for the hottest glints.
  sparkles: ['#fde68a', '#fbbf24', '#fcd34d', '#ffffff', '#fef3c7'],
  hearts: ['#f472b6', '#ec4899', '#a855f7', '#c084fc', '#fb7185'],
  // One warm family: applause is a sound, not a colour show.
  applause: ['#fbbf24', '#f59e0b', '#fcd34d', '#fff7ed'],
  fireworks: ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#e879f9', '#ffffff'],
};

const TAU = Math.PI * 2;

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)]!;
}

/** A particle with the boring defaults filled in. */
function base(p: Partial<Particle> & Pick<Particle, 'color' | 'kind'>): Particle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    size: 6,
    age: 0,
    life: 1.2,
    gravity: 0,
    drag: 1,
    flutter: 0,
    flutterRate: 0,
    sway: 0,
    swayRate: 0,
    ...p,
  };
}

/**
 * Build a burst.
 *
 * `scale` is the pad's size relative to its 150px default, so a big pad throws
 * a proportionally big burst instead of the same small one in a larger box.
 */
export function spawnBurst(reaction: string, scale: number, rand: () => number): Particle[] {
  const s = Math.max(0.55, Math.min(3, scale));
  const colors = REACTION_PALETTE[reaction] ?? REACTION_PALETTE.confetti!;
  const out: Particle[] = [];

  if (reaction === 'sparkles') {
    // A slow, wide twinkle. Low speed and heavy drag so they hang and glitter
    // rather than shooting away; the effect is the flicker, not the flight.
    for (let i = 0; i < 54; i++) {
      const a = rand() * TAU;
      const speed = (40 + rand() * 150) * s;
      out.push(
        base({
          kind: rand() < 0.62 ? 'star' : 'dot',
          color: pick(colors, rand),
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 30 * s,
          size: (2 + rand() * 5) * s,
          spin: (rand() - 0.5) * 5,
          gravity: -18 * s,
          drag: 0.12,
          life: 0.9 + rand() * 0.8,
        }),
      );
    }
    return out;
  }

  if (reaction === 'hearts') {
    // Buoyant and STAGGERED: negative gravity, strong sway, long life, and a
    // launch delay spread across the first third of a second.
    //
    // The stagger is the fix that mattered. Released together they left the
    // pad as one clump and stayed a clump, because a slow rise gives them no
    // time to separate — hearts should read as a stream somebody is letting
    // go of, and the eye should be able to follow a single one up.
    for (let i = 0; i < 30; i++) {
      out.push(
        base({
          kind: 'heart',
          color: pick(colors, rand),
          x: (rand() - 0.5) * 110 * s,
          y: (rand() - 0.5) * 40 * s,
          // Wider fan and a faster rise than the first attempt, which was slow
          // enough that half a second in they had barely cleared the pad.
          vx: (rand() - 0.5) * 190 * s,
          vy: (-190 - rand() * 210) * s,
          size: (7 + rand() * 9) * s,
          rot: (rand() - 0.5) * 0.5,
          spin: (rand() - 0.5) * 1.2,
          gravity: -55 * s,
          drag: 0.5,
          sway: (40 + rand() * 55) * s,
          swayRate: 1.6 + rand() * 1.8,
          age: -rand() * 0.34,
          life: 1.3 + rand() * 0.7,
        }),
      );
    }
    return out;
  }

  if (reaction === 'applause') {
    // Sound, drawn: three expanding rings plus a spray of dots pushed out to
    // the sides. Rings alone are too clean, dots alone say nothing.
    for (let i = 0; i < 3; i++) {
      out.push(
        base({
          kind: 'ring',
          color: colors[i % colors.length]!,
          size: 8 * s,
          // The ring GROWS via its velocity-free size term in the stepper; the
          // stagger is what makes it read as a pulse rather than one hoop.
          vx: 0,
          vy: 0,
          life: 0.85 + i * 0.16,
          age: -i * 0.13,
          spin: 0,
        }),
      );
    }
    for (let i = 0; i < 48; i++) {
      // Biased left and right rather than uniform: hands are at the sides.
      const side = rand() < 0.5 ? -1 : 1;
      const a = side * (0.15 + rand() * 1.15) - Math.PI / 2;
      const speed = (150 + rand() * 300) * s;
      out.push(
        base({
          kind: 'dot',
          color: pick(colors, rand),
          vx: Math.cos(a) * speed * side * (side < 0 ? -1 : 1),
          vy: Math.sin(a) * speed,
          size: (2 + rand() * 4) * s,
          gravity: 420 * s,
          drag: 0.5,
          life: 0.7 + rand() * 0.5,
        }),
      );
    }
    return out;
  }

  if (reaction === 'fireworks') {
    // Three shells at staggered delays, each an even ring of sparks with a
    // little jitter, plus a bright core. Even spacing is what makes a shell
    // look like a shell; jitter alone looks like a sneeze.
    for (let shell = 0; shell < 3; shell++) {
      const cx = (rand() - 0.5) * 150 * s;
      const cy = (rand() - 0.5) * 110 * s - 30 * s;
      const hue = pick(colors, rand);
      const count = 26 + Math.floor(rand() * 10);
      const power = (210 + rand() * 190) * s;
      const delay = shell * 0.22;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + rand() * 0.16;
        const speed = power * (0.72 + rand() * 0.42);
        out.push(
          base({
            kind: 'spark',
            // Most sparks take the shell's colour so it reads as one
            // explosion; a few white ones are the hot centre.
            color: rand() < 0.16 ? '#ffffff' : hue,
            x: cx,
            y: cy,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            size: (1.6 + rand() * 2.6) * s,
            gravity: 240 * s,
            drag: 0.22,
            age: -delay,
            life: 0.85 + rand() * 0.6,
          }),
        );
      }
    }
    return out;
  }

  // Confetti. Launched UP in a fan and pulled back down, so the burst has a
  // rise and a fall rather than one straight throw.
  for (let i = 0; i < 88; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.1;
    const speed = (220 + rand() * 420) * s;
    out.push(
      base({
        kind: rand() < 0.82 ? 'ribbon' : 'dot',
        color: pick(colors, rand),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        size: (3.5 + rand() * 5.5) * s,
        rot: rand() * TAU,
        spin: (rand() - 0.5) * 14,
        gravity: (640 + rand() * 260) * s,
        drag: 0.42,
        flutter: rand() * TAU,
        flutterRate: 5 + rand() * 9,
        sway: (18 + rand() * 34) * s,
        swayRate: 1.4 + rand() * 2.4,
        life: 1.2 + rand() * 0.8,
      }),
    );
  }
  return out;
}

/**
 * Integrate one axis of motion under linear drag and constant acceleration,
 * exactly.
 *
 * With drag `k` and acceleration `g` the closed form is
 *
 *   v(t) = vT + (v0 - vT)·e^(-k·t),   where vT = g/k is the terminal velocity
 *   x(t) = x0 + vT·t + (v0 - vT)·(1 - e^(-k·t))/k
 *
 * Using it rather than stepping `v += g·dt; x += v·dt` is what makes the burst
 * frame-rate independent. Euler's velocity is already independent (the decay
 * is exponential either way) but its POSITION is not: the same 0.2s in one
 * step and in twenty landed 3px apart, so a 120Hz screen and a 60Hz screen
 * drew measurably different bursts. A test pins this.
 *
 * `k = 0` has no terminal velocity to divide by, so it falls back to the
 * ordinary constant-acceleration form.
 */
function integrate(
  pos: number,
  vel: number,
  accel: number,
  drag: number,
  dt: number,
): { pos: number; vel: number } {
  if (drag <= 1e-6) {
    return { pos: pos + vel * dt + 0.5 * accel * dt * dt, vel: vel + accel * dt };
  }
  const terminal = accel / drag;
  const decay = Math.exp(-drag * dt);
  return {
    pos: pos + terminal * dt + ((vel - terminal) * (1 - decay)) / drag,
    vel: terminal + (vel - terminal) * decay,
  };
}

/** Advance every particle by `dt` seconds and drop the dead. */
export function stepParticles(ps: Particle[], dt: number): Particle[] {
  const alive: Particle[] = [];
  for (const p of ps) {
    p.age += dt;
    // Negative age is a launch delay: it exists but has not started, and must
    // not drift while it waits.
    if (p.age < 0) {
      alive.push(p);
      continue;
    }
    if (p.age >= p.life) continue;
    // Horizontal carries no acceleration of its own; vertical carries gravity.
    const h = integrate(p.x, p.vx, 0, p.drag, dt);
    const v = integrate(p.y, p.vy, p.gravity, p.drag, dt);
    p.x = h.pos;
    p.vx = h.vel;
    p.y = v.pos;
    p.vy = v.vel;
    // Sway is a displacement, not a force: it wanders the particle sideways
    // without ever changing where it is heading.
    if (p.sway !== 0) p.x += Math.sin(p.age * p.swayRate) * p.sway * dt;
    p.rot += p.spin * dt;
    p.flutter += p.flutterRate * dt;
    alive.push(p);
  }
  return alive;
}

/** 0..1, how far through its life a particle is. Negative age reads as 0. */
export function progressOf(p: Particle): number {
  return p.age <= 0 ? 0 : Math.min(1, p.age / p.life);
}

/**
 * Alpha for a particle: a quick fade in, a long hold, a fade out.
 *
 * Sparkles override the tail with a twinkle, which is the whole character of
 * that reaction — a steady fade would make them ordinary dots.
 */
export function alphaOf(p: Particle): number {
  if (p.age < 0) return 0;
  const t = progressOf(p);
  const fade = t < 0.08 ? t / 0.08 : t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
  if (p.kind === 'star' || p.kind === 'dot') {
    const twinkle = 0.62 + 0.38 * Math.sin(p.flutter + p.age * 15);
    return Math.max(0, fade * (p.kind === 'star' ? twinkle : 1));
  }
  return Math.max(0, fade);
}

/** Draw one particle at the canvas origin already translated to its position. */
export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const alpha = alphaOf(p);
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;

  switch (p.kind) {
    case 'ribbon': {
      // The squash is the tumble: the rectangle's width follows a cosine, so
      // it turns edge-on and back like paper rather than spinning flat.
      const w = p.size * 2 * Math.abs(Math.cos(p.flutter));
      ctx.fillRect(-w / 2, -p.size * 0.75, Math.max(0.6, w), p.size * 1.5);
      break;
    }
    case 'star': {
      // A four-point glint, which reads as sparkle at 4px where a five-point
      // star reads as mush.
      const r = p.size;
      const w = r * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(w, -w, r, 0);
      ctx.quadraticCurveTo(w, w, 0, r);
      ctx.quadraticCurveTo(-w, w, -r, 0);
      ctx.quadraticCurveTo(-w, -w, 0, -r);
      ctx.fill();
      break;
    }
    case 'heart': {
      const r = p.size;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.72);
      ctx.bezierCurveTo(-r * 1.3, -r * 0.15, -r * 0.52, -r, 0, -r * 0.36);
      ctx.bezierCurveTo(r * 0.52, -r, r * 1.3, -r * 0.15, 0, r * 0.72);
      ctx.fill();
      break;
    }
    case 'ring': {
      // Grows with age; the stroke thins as it expands, like a wave losing
      // energy rather than a circle being scaled.
      const t = progressOf(p);
      const r = p.size + t * p.size * 9;
      ctx.globalAlpha = alpha * (1 - t) * 0.8;
      ctx.lineWidth = Math.max(0.7, p.size * 0.5 * (1 - t));
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      break;
    }
    case 'spark': {
      // Drawn as a short streak along its own velocity, which is what gives a
      // firework its sense of speed; a round dot looks static however fast it
      // is actually moving.
      const speed = Math.hypot(p.vx, p.vy);
      const len = Math.min(26, speed * 0.03);
      ctx.rotate(Math.atan2(p.vy, p.vx) - p.rot);
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      break;
    }
    case 'dot':
    default: {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, TAU);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}
