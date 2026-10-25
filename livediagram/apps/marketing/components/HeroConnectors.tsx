'use client';

// The hero's connector (docs/specs/019-marketing/marketing-site.md "Hero"): on load, an arrow draws
// from the end of the headline's question down to the template search, the gesture of the editor's
// loading animation (DiagramBuildAnimation in apps/editor: a connector draws, its head lands, the
// target flashes a selection ring, a pulse of light runs along it), drawn in marker on the hero's
// whiteboard, with "start here" scrawled beside its curve (or under its tip) where that fits, and a looser
// stroke underlining the headline's last line. The question is wired to
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
import { WHITEBOARD_COPY } from './hero-draw-copy';

type Point = [number, number];
type Layout = {
  w: number;
  h: number;
  // The curve's start, its two controls and where it ends, then the tip the straight run reaches.
  p: [Point, Point, Point, Point, Point];
  ring: { x: number; y: number; w: number; h: number };
  // Where "start here" is written, beside the curve or under the tip; null where the band has no room for it.
  note: Point | null;
  // The marker's underline under the headline's last line, left end and right end.
  under: [Point, Point];
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

// The note beside the curve: how far right of the sweep it starts, and below the curve's middle.
const NOTE_GAP = 18;
const NOTE_DROP = 10;
// The fallback under the tip: how far right of the tip and below the line it starts, and the room it needs.
const NOTE_DX = 4;
const NOTE_DY = 42;
const NOTE_W = 120;
// The note may run out past the copy's column onto the band, but stays this far inside the band's right
// edge, clear of the share rail.
const BAND_CLEAR = 88;
// The marker (app/hero-whiteboard.css), the prism's sky, light or dark.
const MARKER = { stroke: 'var(--wb-marker)' } as const;

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
  const bandRight = (root.closest('section') ?? root).getBoundingClientRect().right - o.left;
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
    note:
      clear + NOTE_GAP + NOTE_W <= bandRight - BAND_CLEAR
        ? [clear + NOTE_GAP, (start[1] + end[1]) / 2 + NOTE_DROP]
        : end[0] + NOTE_DX + NOTE_W <= o.width - EDGE_CLEAR
          ? [end[0] + NOTE_DX, end[1] + NOTE_DY]
          : null,
    under: [
      [last.left - o.left + 6, last.bottom - o.top + 2],
      [last.right - o.left - 6, last.bottom - o.top - 2],
    ],
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
        <rect
          className="hero-conn-ring"
          x={layout.ring.x}
          y={layout.ring.y}
          width={layout.ring.w}
          height={layout.ring.h}
          rx={22}
          fill="none"
          style={MARKER}
          strokeOpacity={0.6}
          strokeWidth={2}
          strokeDasharray="7 6"
        />
        {/* A marker leaves a fainter second pass beside its stroke; both draw on together. */}
        <path
          className="hero-conn-line"
          d={path}
          pathLength={1}
          fill="none"
          style={MARKER}
          strokeOpacity={0.3}
          strokeWidth={2}
          strokeLinecap="round"
          transform="translate(1.5 2)"
        />
        <path
          className="hero-conn-line"
          d={path}
          pathLength={1}
          fill="none"
          style={MARKER}
          strokeWidth={4.5}
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
            d={`M ${d[0] - 14} ${d[1] - 10} L ${d[0]} ${d[1]} L ${d[0] - 13} ${d[1] + 9}`}
            fill="none"
            style={MARKER}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        {/* The underline: a marker swipe, a touch uphill, dipping in the middle. */}
        <path
          className="hero-conn-line"
          d={`M ${layout.under[0][0]} ${layout.under[0][1]} Q ${(layout.under[0][0] + layout.under[1][0]) / 2} ${layout.under[0][1] + 6}, ${layout.under[1][0]} ${layout.under[1][1]}`}
          pathLength={1}
          fill="none"
          style={MARKER}
          strokeOpacity={0.75}
          strokeWidth={5}
          strokeLinecap="round"
        />
        {layout.note ? (
          <text
            className="hero-conn-note hero-wb-note"
            x={layout.note[0]}
            y={layout.note[1]}
            // Turned about its own middle: hero-animations.css gives it a fill-box origin.
            transform="rotate(-6)"
            fontSize={30}
            style={{ fill: 'var(--wb-marker)' }}
          >
            {WHITEBOARD_COPY.startHere}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
