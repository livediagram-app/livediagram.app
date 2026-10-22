'use client';

// The hero's connector (docs/specs/019-marketing/marketing-site.md "Hero"): on load, an arrow draws
// from the end of the headline's question down to the template search, the gesture of the editor's
// loading animation (DiagramBuildAnimation in apps/live: a gradient connector draws, its head lands,
// the target flashes a selection ring, a pulse of light runs along it). The question is wired to
// where it is answered, as a diagram would wire them.
//
// The geometry is the page's own, so it is measured, not drawn to a fixed picture: the headline's
// last line, the subhead and the search bar, found by their data-hero-anchor within the hero,
// re-measured on resize and once web fonts settle. The arrow leaves the end of "today?" heading
// right, so it is out past the subhead's right edge before it reaches the subhead's height, drops
// down clear of the copy, and hooks left into the search bar's right end: it never crosses text.
// Nothing renders until measured (or where the window is too narrow to keep that clearance), and it
// is absolutely positioned, so it shifts nothing. Shown from lg, where there is room beside the copy. It plays once; reduced motion shows it settled. Keyframes
// live in app/hero-animations.css (hero-conn-*).

import { useLayoutEffect, useRef, useState } from 'react';

type Point = [number, number];
type Layout = {
  w: number;
  h: number;
  // The curve's start, its two controls and where it ends, then the tip the straight run reaches.
  p: [Point, Point, Point, Point, Point];
  ring: { x: number; y: number; w: number; h: number };
};

// How far the line starts clear of the text and stops clear of the bar, and the least it bows out past
// its start, in CSS px.
const TEXT_GAP = 16;
const TARGET_GAP = 14;
const BOW = 120;
const RING_PAD = 7;
// How far the sweep stays clear of the subhead's and the bar's right edges, and of the page's edge.
const LEAD_CLEAR = 56;
const BAR_CLEAR = 96;
const EDGE_CLEAR = 12;
// The straight run into the bar after the curve, so the line meets the arrowhead level at its tip.
const LEAD_IN = 28;

// The brand mark's prism (packages/ui/src/brand-prism.ts): its vivid violet out of the headline, its
// primary purple into the search.
const FROM = '#7c3aed';
const TO = '#9333ea';

function measure(root: HTMLElement): Layout | null {
  const title = root.querySelector<HTMLElement>('[data-hero-anchor="title"]');
  const target = root.querySelector<HTMLElement>('[data-hero-anchor="target"]');
  if (!title || !target) return null;
  // The headline wraps (balanced), so its end is the right edge of its last line box.
  const range = document.createRange();
  // Line boxes need layout: a browser without them (or a test DOM) draws no arrow.
  if (typeof range.getClientRects !== 'function') return null;
  range.selectNodeContents(title);
  const lines = range.getClientRects();
  const last = lines[lines.length - 1];
  if (!last) return null;
  const lead = root
    .querySelector<HTMLElement>('[data-hero-anchor="lead"]')
    ?.getBoundingClientRect();
  const o = root.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const start: Point = [last.right - o.left + TEXT_GAP, last.top + last.height * 0.55 - o.top];
  const end: Point = [t.right - o.left + TARGET_GAP, t.top + t.height / 2 - o.top];
  // The sweep's outer edge: past the subhead, the bar and the headline's end, whichever is furthest.
  const clear = Math.max(
    start[0] + BOW,
    t.right - o.left + BAR_CLEAR,
    lead ? lead.right - o.left + LEAD_CLEAR : 0,
  );
  // With no room for that beside the copy, draw nothing rather than cross it.
  if (clear > o.width - EDGE_CLEAR) return null;
  return {
    w: o.width,
    h: o.height,
    // Out to the right level with the headline, down at the clear edge, round towards the bar, then
    // a straight run in to the tip.
    p: [start, [clear, start[1]], [clear, end[1]], [end[0] + LEAD_IN, end[1]], end],
    ring: {
      x: t.left - o.left - RING_PAD,
      y: t.top - o.top - RING_PAD,
      w: t.width + RING_PAD * 2,
      h: t.height + RING_PAD * 2,
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
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  if (!layout) {
    return <div ref={ref} aria-hidden className="hidden" />;
  }
  const [a, b, c, e, d] = layout.p;
  const path = `M ${a[0]} ${a[1]} C ${b[0]} ${b[1]}, ${c[0]} ${c[1]}, ${e[0]} ${e[1]} L ${d[0]} ${d[1]}`;
  // The head points along the straight run, so it sits square on the line.
  const angle = (Math.atan2(d[1] - e[1], d[0] - e[0]) * 180) / Math.PI;
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
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
          rx={22}
          fill="none"
          stroke={TO}
          strokeOpacity={0.6}
          strokeWidth={1.5}
          strokeDasharray="6 5"
        />
        <path
          className="hero-conn-line"
          d={path}
          pathLength={1}
          fill="none"
          stroke="url(#hero-conn-grad)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <path
          className="hero-conn-pulse"
          d={path}
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
