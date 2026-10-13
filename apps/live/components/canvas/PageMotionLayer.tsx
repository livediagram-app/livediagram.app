'use client';

// A slide's animated background (docs/specs/007-editor/illustrate-pages.md "Animated
// backgrounds"): the moving parts drawn over the page's gradient and under everything on it, on
// screen and while presenting. Its keyframes are app/motion-page.css.
//
// Kept cheap and calm: every part moves by transform and opacity alone (the compositor's work, no
// repaint per frame), soft edges are radial gradients rather than blur filters, each motion has at
// most a few dozen parts, and loops run 9 to 48 seconds. Reduced motion stops every part where it
// rests, a still frame that is itself a finished background. Positions come from fixed seeds, so a
// slide looks the same wherever it is opened.
import type { CSSProperties, ReactNode } from 'react';
import type { PageMotion } from '@livediagram/document';
import { motionPaint, motionSeed, type MotionPaint } from '@/lib/page-motion';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

type Size = { w: number; h: number };

export function PageMotionLayer({
  motion,
  fill,
  width,
  height,
}: {
  motion: PageMotion;
  fill: { from: string; to: string };
  // The sheet's size in its own px.
  width: number;
  height: number;
}) {
  const paint = motionPaint(fill);
  const size = { w: width, h: height };
  return (
    <div
      aria-hidden
      data-page-motion={motion}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity: paint.strength }}
    >
      {MOTIONS[motion](size, paint)}
    </div>
  );
}

const MOTIONS: Record<PageMotion, (s: Size, p: MotionPaint) => ReactNode> = {
  flow: Flow,
  drift: Drift,
  aurora: Aurora,
  ripple: Ripple,
  ribbons: Ribbons,
  mesh: Mesh,
  starfield: Starfield,
  'retro-grid': RetroGrid,
  bokeh: Bokeh,
  waves: Waves,
  spotlight: Spotlight,
  beams: Beams,
};

// A colour at an alpha, for gradients: `color-mix` keeps any hex as it is.
const alpha = (c: string, a: number) =>
  `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
// A soft round light: full at its centre, gone at its edge.
const glow = (c: string, a: number) =>
  `radial-gradient(closest-side, ${alpha(c, a)} 0%, ${alpha(c, a * 0.45)} 45%, transparent 100%)`;

function Part({ className, style }: { className: string; style: Vars }) {
  return <div className={`absolute ${className}`} style={style} />;
}

// ── Flow: fine diagonal lines streaming along, one period a loop, so it never seams. ────────────
function Flow({ w, h }: Size, p: MotionPaint) {
  const gap = Math.max(w, h) / 14;
  const step = gap * Math.SQRT2;
  return (
    <Part
      className="pm-slide-x"
      style={{
        left: -step * 2,
        top: -step,
        width: w + step * 4,
        height: h + step * 2,
        backgroundImage: `repeating-linear-gradient(135deg, transparent 0 ${gap - 2}px, ${alpha(p.hi, 0.28)} ${gap - 2}px ${gap}px)`,
        '--pm-d': '9s',
        '--pm-x': `${step}px`,
      }}
    />
  );
}

// ── Drift: bubbles rising from the lower half and fading as they go. ───────────────────────────
function Drift({ w, h }: Size, p: MotionPaint) {
  const unit = Math.min(w, h);
  return Array.from({ length: 14 }, (_, i) => {
    const d = unit * (0.05 + motionSeed(i, 1) * 0.11);
    const dur = 14 + motionSeed(i, 2) * 14;
    return (
      <Part
        key={i}
        className="pm-rise"
        style={{
          left: motionSeed(i, 3) * (w - d),
          top: h * (0.45 + motionSeed(i, 4) * 0.5),
          width: d,
          height: d,
          borderRadius: '50%',
          background: glow(p.hi, 0.55),
          '--pm-d': `${dur}s`,
          '--pm-dl': `${-motionSeed(i, 5) * dur}s`,
          '--pm-y': `${-h * 0.55}px`,
        }}
      />
    );
  });
}

// ── Aurora: three broad lights wandering slowly on looping paths. ──────────────────────────────
function Aurora({ w, h }: Size, p: MotionPaint) {
  const lights = [
    { c: p.cool, x: 0.2, y: 0.12, s: 1.0, a: 0.5, d: 26 },
    { c: p.warm, x: 0.62, y: 0.2, s: 1.15, a: 0.45, d: 32 },
    { c: p.hi, x: 0.45, y: 0.05, s: 0.8, a: 0.28, d: 21 },
    { c: p.b, x: 0.3, y: 0.6, s: 1.0, a: 0.7, d: 38 },
  ];
  const unit = Math.max(w, h);
  return lights.map((l, i) => (
    <Part
      key={i}
      className="pm-wander"
      style={{
        left: w * l.x - (unit * l.s) / 2,
        top: h * l.y - (unit * l.s * 0.6) / 2,
        width: unit * l.s,
        height: unit * l.s * 0.6,
        background: glow(l.c, l.a),
        '--pm-d': `${l.d}s`,
        '--pm-dl': `${-i * 7}s`,
        '--pm-x': `${w * 0.18}px`,
        '--pm-y': `${h * 0.12}px`,
      }}
    />
  ));
}

// ── Ripple: rings spreading out from the centre, one after another. ────────────────────────────
function Ripple({ w, h }: Size, p: MotionPaint) {
  const d = Math.max(w, h) * 1.1;
  return Array.from({ length: 4 }, (_, i) => (
    <Part
      key={i}
      className="pm-spread"
      style={{
        left: w / 2 - d / 2,
        top: h / 2 - d / 2,
        width: d,
        height: d,
        borderRadius: '50%',
        border: `${Math.max(2, d / 220)}px solid ${alpha(p.hi, 0.4)}`,
        '--pm-d': '12s',
        '--pm-dl': `${-i * 3}s`,
        // At rest (reduced motion) the rings stand still, nested.
        '--pm-rest': (i + 1) / 4,
      }}
    />
  ));
}

// One wave's path across two periods of `w`, so sliding it by `w` loops without a seam.
function wavePath(w: number, h: number, amp: number, base: number, periods: number): string {
  const seg = w / periods;
  let d = `M0 ${base}`;
  for (let i = 0; i < periods * 2; i += 1) {
    const x = i * seg;
    const up = i % 2 === 0 ? -amp : amp;
    d += ` Q${x + seg / 2} ${base + up} ${x + seg} ${base}`;
  }
  return `${d} V${h} H0 Z`;
}

function SlidingWave({
  w,
  h,
  amp,
  base,
  periods,
  color,
  dur,
  delay,
  reverse,
}: {
  w: number;
  h: number;
  amp: number;
  base: number;
  periods: number;
  color: string;
  dur: number;
  delay: number;
  reverse?: boolean;
}) {
  return (
    <svg
      className={`absolute left-0 top-0 ${reverse ? 'pm-slide-x-back' : 'pm-slide-x-neg'}`}
      width={w * 2}
      height={h}
      viewBox={`0 0 ${w * 2} ${h}`}
      style={{ '--pm-d': `${dur}s`, '--pm-dl': `${delay}s`, '--pm-x': `${-w}px` } as Vars}
    >
      <path d={wavePath(w, h, amp, base, periods)} fill={color} />
    </svg>
  );
}

// ── Ribbons: bands of colour flowing sideways at different paces. ──────────────────────────────
function Ribbons({ w, h }: Size, p: MotionPaint) {
  return (
    <>
      <SlidingWave
        w={w}
        h={h}
        amp={h * 0.08}
        base={h * 0.3}
        periods={2}
        color={alpha(p.hi, 0.16)}
        dur={30}
        delay={0}
      />
      <SlidingWave
        w={w}
        h={h}
        amp={h * 0.1}
        base={h * 0.5}
        periods={3}
        color={alpha(p.b, 0.35)}
        dur={24}
        delay={-6}
        reverse
      />
      <SlidingWave
        w={w}
        h={h}
        amp={h * 0.07}
        base={h * 0.68}
        periods={2}
        color={alpha(p.hi, 0.12)}
        dur={36}
        delay={-12}
      />
    </>
  );
}

// ── Waves: an ocean along the bottom, three layers rolling at their own speeds. ────────────────
function Waves({ w, h }: Size, p: MotionPaint) {
  return (
    <>
      <SlidingWave
        w={w}
        h={h}
        amp={h * 0.035}
        base={h * 0.72}
        periods={3}
        color={alpha(p.hi, 0.12)}
        dur={22}
        delay={-4}
      />
      <SlidingWave
        w={w}
        h={h}
        amp={h * 0.04}
        base={h * 0.79}
        periods={4}
        color={alpha(p.b, 0.55)}
        dur={16}
        delay={-9}
        reverse
      />
      <SlidingWave
        w={w}
        h={h}
        amp={h * 0.03}
        base={h * 0.86}
        periods={3}
        color={alpha(p.lo, 0.7)}
        dur={12}
        delay={0}
      />
    </>
  );
}

// ── Mesh: an oversized field of the page's colours turning slowly about the centre. ────────────
function Mesh({ w, h }: Size, p: MotionPaint) {
  const d = Math.hypot(w, h) * 1.15;
  return (
    <Part
      className="pm-turn"
      style={{
        left: w / 2 - d / 2,
        top: h / 2 - d / 2,
        width: d,
        height: d,
        background: [
          `radial-gradient(circle at 25% 30%, ${alpha(p.cool, 0.6)}, transparent 42%)`,
          `radial-gradient(circle at 75% 35%, ${alpha(p.b, 0.9)}, transparent 45%)`,
          `radial-gradient(circle at 40% 78%, ${alpha(p.a, 0.9)}, transparent 48%)`,
          `radial-gradient(circle at 80% 80%, ${alpha(p.warm, 0.55)}, transparent 40%)`,
          `radial-gradient(circle at 55% 50%, ${alpha(p.hi, 0.25)}, transparent 30%)`,
        ].join(', '),
        '--pm-d': '48s',
      }}
    />
  );
}

// ── Starfield: stars of three sizes twinkling on their own beats while the sky drifts. ─────────
function Starfield({ w, h }: Size, p: MotionPaint) {
  const unit = Math.min(w, h);
  const stars = Array.from({ length: 46 }, (_, i) => {
    const big = motionSeed(i, 7) > 0.85;
    const d = unit * (big ? 0.012 : 0.004 + motionSeed(i, 8) * 0.004);
    const dur = 3 + motionSeed(i, 9) * 5;
    return (
      <Part
        key={i}
        className="pm-twinkle"
        style={{
          left: motionSeed(i, 10) * w * 1.1 - w * 0.05,
          top: motionSeed(i, 11) * h,
          width: d,
          height: d,
          borderRadius: '50%',
          background: p.hi,
          boxShadow: big ? `0 0 ${d * 2}px ${alpha(p.hi, 0.8)}` : undefined,
          '--pm-d': `${dur}s`,
          '--pm-dl': `${-motionSeed(i, 12) * dur}s`,
        }}
      />
    );
  });
  return (
    <>
      <Part
        className="pm-wander"
        style={{
          left: w * 0.45,
          top: -h * 0.4,
          width: w,
          height: h,
          background: glow(p.b, 0.5),
          '--pm-d': '40s',
          '--pm-x': `${-w * 0.2}px`,
          '--pm-y': `${h * 0.1}px`,
        }}
      />
      <div
        className="pm-slide-x-neg absolute left-0 top-0"
        style={{ width: w, height: h, '--pm-d': '90s', '--pm-x': `${-w * 0.05}px` } as Vars}
      >
        {stars}
      </div>
    </>
  );
}

// ── Retro Grid: a neon grid rolling toward a glowing horizon. ──────────────────────────────────
function RetroGrid({ w, h }: Size, p: MotionPaint) {
  const cell = Math.max(w, h) / 12;
  const line = Math.max(1.5, cell / 26);
  return (
    <>
      <Part
        className=""
        style={{
          left: 0,
          top: h * 0.32,
          width: w,
          height: h * 0.4,
          background: `radial-gradient(closest-side, ${alpha(p.hi, 0.6)}, transparent)`,
        }}
      />
      <div
        className="absolute left-0 overflow-hidden"
        style={{
          top: h * 0.55,
          width: w,
          height: h * 0.45,
          perspective: h * 0.6,
          // The horizon fades the far rows into the page, whatever its colour there.
          maskImage: 'linear-gradient(transparent, #000 45%)',
          WebkitMaskImage: 'linear-gradient(transparent, #000 45%)',
        }}
      >
        <div
          className="absolute"
          style={{
            left: -w,
            top: 0,
            width: w * 3,
            height: h * 1.6,
            transform: 'rotateX(62deg)',
            transformOrigin: '50% 0',
          }}
        >
          <div
            className="pm-slide-y absolute inset-0"
            style={
              {
                top: -cell,
                backgroundImage: `linear-gradient(${alpha(p.hi, 0.75)} ${line}px, transparent ${line}px), linear-gradient(90deg, ${alpha(p.hi, 0.75)} ${line}px, transparent ${line}px)`,
                backgroundSize: `${cell}px ${cell}px`,
                '--pm-d': '4s',
                '--pm-y': `${cell}px`,
              } as Vars
            }
          />
        </div>
      </div>
    </>
  );
}

// ── Bokeh: soft out-of-focus lights of many sizes floating and breathing. ──────────────────────
function Bokeh({ w, h }: Size, p: MotionPaint) {
  const unit = Math.min(w, h);
  return Array.from({ length: 16 }, (_, i) => {
    const d = unit * (0.08 + motionSeed(i, 13) * 0.26);
    const dur = 16 + motionSeed(i, 14) * 18;
    const c = [p.hi, p.cool, p.hi, p.warm, p.b][i % 5]!;
    return (
      <Part
        key={i}
        className="pm-float"
        style={{
          left: motionSeed(i, 15) * w - d / 2,
          top: motionSeed(i, 16) * h - d / 2,
          width: d,
          height: d,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(c, 0.32)} 0%, ${alpha(c, 0.22)} 55%, transparent 70%)`,
          '--pm-d': `${dur}s`,
          '--pm-dl': `${-motionSeed(i, 17) * dur}s`,
          '--pm-x': `${(motionSeed(i, 18) - 0.5) * w * 0.16}px`,
          '--pm-y': `${(motionSeed(i, 19) - 0.5) * h * 0.18}px`,
        }}
      />
    );
  });
}

// ── Spotlight: a stage light sweeping across, a softer one answering it. ───────────────────────
function Spotlight({ w, h }: Size, p: MotionPaint) {
  const d = Math.max(w, h) * 0.9;
  return (
    <>
      <Part
        className="pm-sweep"
        style={{
          left: -d / 2,
          top: -d * 0.35,
          width: d,
          height: d,
          background: glow(p.hi, 0.55),
          '--pm-d': '14s',
          '--pm-x': `${w}px`,
        }}
      />
      <Part
        className="pm-sweep"
        style={{
          left: w - d * 0.4,
          top: h - d * 0.55,
          width: d * 0.8,
          height: d * 0.8,
          background: glow(p.b, 0.6),
          '--pm-d': '19s',
          '--pm-dl': '-9s',
          '--pm-x': `${-w * 0.8}px`,
        }}
      />
    </>
  );
}

// ── Beams: tall shafts of light gliding past at a slant, one after another. ────────────────────
function Beams({ w, h }: Size, p: MotionPaint) {
  const bw = Math.max(w, h) * 0.14;
  return Array.from({ length: 5 }, (_, i) => {
    const dur = 11 + motionSeed(i, 20) * 7;
    return (
      <Part
        key={i}
        className="pm-glide"
        style={{
          left: -bw * 2,
          top: -h * 0.4,
          width: bw * (0.5 + motionSeed(i, 21)),
          height: h * 1.8,
          background: `linear-gradient(90deg, transparent, ${alpha(p.hi, 0.22 + motionSeed(i, 22) * 0.12)}, transparent)`,
          '--pm-d': `${dur}s`,
          '--pm-dl': `${-motionSeed(i, 23) * dur}s`,
          '--pm-x': `${w + bw * 4}px`,
        }}
      />
    );
  });
}
