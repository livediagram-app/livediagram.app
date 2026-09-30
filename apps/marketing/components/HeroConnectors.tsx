'use client';

// The hero's connector (docs/specs/019-marketing/marketing-site.md): on load, an arrow draws from
// the headline down to the illustration, the gesture of the editor's loading animation
// (DiagramBuildAnimation in apps/live: a gradient connector draws, its head lands, the target
// flashes a selection ring, a pulse of light runs along it). The page's first line is wired to
// the canvas it promises, as a diagram would wire them.
//
// The geometry is the page's own, so it is measured, not drawn to a fixed picture: the headline's
// last line of text (a Range, not the h1's box, which is wider than its words) and the stage's
// centred window, found by their data-hero-anchor within the hero, re-measured on resize. The
// arrow leaves the right end of that line, sweeps out past the buttons and proof points, and
// comes down into the top of the centred window. Nothing renders until measured, and it is
// absolutely positioned, so it shifts nothing. Hidden below sm, where there is no room beside the
// copy for the sweep. It plays once; reduced motion shows it settled. Keyframes live in
// app/hero-animations.css (hero-conn-*).

import { useLayoutEffect, useRef, useState } from 'react';
import { HERO_TITLE_SHIFT_EVENT } from './HeroRotatingWord';

type Point = [number, number];
type Layout = {
  w: number;
  h: number;
  p: [Point, Point, Point, Point];
  ring: { x: number; y: number; w: number; h: number };
};

// How far the line starts clear of the text and stops clear of the window, how wide the sweep
// bows out past its start, and where along the window's top it lands (a fraction of its width
// right of centre), in CSS px unless noted.
const TEXT_GAP = 16;
const WINDOW_GAP = 10;
const BOW = 110;
const LAND = 0.43;
const RING_PAD = 6;
// How far the sweep's bow stays clear of the subhead's right edge.
const LEAD_CLEAR = 60;

// The loading animation's palette: sky out of the headline, violet into the window.
const FROM = '#0ea5e9';
const TO = '#8b5cf6';

function measure(root: HTMLElement): Layout | null {
  const title = root.querySelector<HTMLElement>('[data-hero-anchor="title"]');
  const stage = root.querySelector<HTMLElement>('[data-hero-anchor="stage"]');
  const card = root.querySelector<HTMLElement>('[data-hero-anchor="window"]');
  if (!title || !stage || !card) return null;
  // The headline is one line whose right end is the end of "live." (HeroTitleLine right-aligns
  // its rotating word against the rest). The line glides with a transform to stay centred; read
  // its resting edge (undoing whatever glide is mid-flight) plus the glide it is heading for, so
  // the arrow's start lands where "live." will end.
  const t = title.getBoundingClientRect();
  const current = new DOMMatrixReadOnly(getComputedStyle(title).transform).m41;
  const right = t.right - current + Number(title.dataset.shift ?? 0);
  const lead = root
    .querySelector<HTMLElement>('[data-hero-anchor="lead"]')
    ?.getBoundingClientRect();
  const o = root.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  // The centred window: every window is the same size, and the stage centres the active one.
  const cx = s.left + s.width / 2 - o.left;
  const top = s.top - o.top;
  const start: Point = [right - o.left + TEXT_GAP, t.top + t.height * 0.55 - o.top];
  // The sweep bows out past the subhead, whatever the headline's length, so it never crosses copy.
  const clear = lead ? lead.right - o.left + LEAD_CLEAR : 0;
  const end: Point = [cx + c.width * LAND, top - WINDOW_GAP];
  const drop = end[1] - start[1];
  return {
    w: o.width,
    h: o.height,
    p: [
      start,
      [Math.max(start[0] + BOW, clear), start[1] + drop * 0.25],
      [end[0] + BOW * 0.15, end[1] - drop * 0.5],
      end,
    ],
    ring: {
      x: cx - c.width / 2 - RING_PAD,
      y: top - RING_PAD,
      w: c.width + RING_PAD * 2,
      h: c.height + RING_PAD * 2,
    },
  };
}

export function HeroConnectors() {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useLayoutEffect(() => {
    const root = ref.current?.parentElement;
    if (!root) return;
    const update = () => setLayout(measure(root));
    update();
    // Web fonts settle the headline's width after first paint; measure again once they have.
    void document.fonts?.ready.then(update);
    const observer = new ResizeObserver(update);
    observer.observe(root);
    // The headline glides to a new centre each time its word changes (HeroTitleLine).
    window.addEventListener(HERO_TITLE_SHIFT_EVENT, update);
    return () => {
      observer.disconnect();
      window.removeEventListener(HERO_TITLE_SHIFT_EVENT, update);
    };
  }, []);

  if (!layout) {
    return <div ref={ref} aria-hidden className="hidden" />;
  }
  const [a, b, c, d] = layout.p;
  const path = `M ${a[0]} ${a[1]} C ${b[0]} ${b[1]}, ${c[0]} ${c[1]}, ${d[0]} ${d[1]}`;
  const angle = (Math.atan2(d[1] - c[1], d[0] - c[0]) * 180) / Math.PI;
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
      <svg className="absolute inset-0 overflow-visible" width={layout.w} height={layout.h}>
        <defs>
          <linearGradient
            id="hero-conn-grad"
            gradientUnits="userSpaceOnUse"
            x1={a[0]}
            y1={a[1]}
            x2={d[0]}
            y2={d[1]}
          >
            <stop offset="0" stopColor={FROM} />
            <stop offset="1" stopColor={TO} />
          </linearGradient>
        </defs>
        <rect
          className="hero-conn-ring"
          x={layout.ring.x}
          y={layout.ring.y}
          width={layout.ring.w}
          height={layout.ring.h}
          rx={16}
          fill="none"
          stroke={TO}
          strokeOpacity={0.6}
          strokeWidth={1.5}
          strokeDasharray="6 5"
        />
        <path
          className="hero-conn-line"
          d={path}
          // As a style too, so a moved start glides (CSS d transition) where supported.
          style={{ d: `path("${path}")` }}
          pathLength={1}
          fill="none"
          stroke="url(#hero-conn-grad)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <path
          className="hero-conn-pulse"
          d={path}
          style={{ d: `path("${path}")` }}
          pathLength={1}
          fill="none"
          stroke="white"
          strokeOpacity={0.9}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <g transform={`rotate(${angle} ${d[0]} ${d[1]})`}>
          <path
            className="hero-conn-head"
            d={`M ${d[0] - 9} ${d[1] - 6} L ${d[0]} ${d[1]} L ${d[0] - 9} ${d[1] + 6}`}
            fill="none"
            stroke={TO}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
