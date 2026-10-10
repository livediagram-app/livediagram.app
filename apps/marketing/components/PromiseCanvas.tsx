'use client';

import {
  lucideEyeOff,
  lucideGift,
  lucideGitFork,
  lucideUsers,
  lucideUserX,
} from '@livediagram/icons/lucide';
import { Brand, ChevronRightIcon, lucideGlyph, type IconProps } from '@livediagram/ui';
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import { PROMISES, type Promise, type PromiseId } from '@/lib/promises';
import { CollaboratorPointer } from './hero-illustration-glyphs';

// The promises (docs/specs/019-marketing/marketing-site.md "Promises"), straight after the
// template gallery, under "Built with your values in mind", told the way the product tells things: as a diagram on a canvas. A
// "livediagram" hub sits in the middle of a dotted canvas, with the five promises as nodes around
// it (Completely Free, No Account Needed, Open Source, Private by Design, Real-Time Collaboration),
// each a card with its value set large in its own hue. When the canvas scrolls into view the hub
// lands, the connectors draw out to each node and the nodes pop in one after another; a pulse then
// keeps travelling each connector out from the hub. Hovering (or focusing) a node selects it as
// the editor would (handles in its hue) and lights its connector. A teammate's cursor drifts
// across the open canvas, and the Real-Time node's dot pings. Below `lg` the canvas becomes a column: the hub on top, the
// nodes stacked on one line down the left. Everything moving sits behind reduced motion
// (app/promises.css).

type Look = {
  Icon: ComponentType<IconProps>;
  // The hue, as a colour for SVG and as classes for the card.
  stroke: string;
  chip: string;
  value: string;
  // Where the node sits on the wide canvas: its centre, in the 1000 x 520 layout box. Its connector
  // runs to that centre, under the card, so the line meets the card's edge at any width.
  at: { x: number; y: number };
};

const LOOK: Record<PromiseId, Look> = {
  free: {
    Icon: lucideGlyph(lucideGift, 20),
    stroke: '#10b981',
    chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    value: 'text-emerald-600 dark:text-emerald-300',
    at: { x: 165, y: 118 },
  },
  'no-account': {
    Icon: lucideGlyph(lucideUserX, 20),
    stroke: '#f59e0b',
    chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    value: 'text-amber-600 dark:text-amber-300',
    at: { x: 165, y: 392 },
  },
  'open-source': {
    Icon: lucideGlyph(lucideGitFork, 20),
    stroke: '#0ea5e9',
    chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    value: 'text-sky-600 dark:text-sky-300',
    at: { x: 835, y: 118 },
  },
  private: {
    Icon: lucideGlyph(lucideEyeOff, 20),
    stroke: '#f43f5e',
    chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
    value: 'text-rose-600 dark:text-rose-300',
    at: { x: 835, y: 392 },
  },
  live: {
    Icon: lucideGlyph(lucideUsers, 20),
    stroke: '#8b5cf6',
    chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    value: 'text-violet-600 dark:text-violet-300',
    at: { x: 500, y: 428 },
  },
};

// The hub's centre in the layout box, and where each connector leaves it.
const HUB = { x: 500, y: 236 };
const HUB_EDGE: Record<PromiseId, { x: number; y: number }> = {
  free: { x: 400, y: 226 },
  'no-account': { x: 400, y: 246 },
  'open-source': { x: 600, y: 226 },
  private: { x: 600, y: 246 },
  live: { x: 500, y: 266 },
};
const BOX = { w: 1000, h: 520 };

// A smooth connector from the hub to a node: out horizontally, then in.
function connectorPath(id: PromiseId) {
  const a = HUB_EDGE[id];
  const b = LOOK[id].at;
  if (id === 'live') return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  const mid = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

// True once the canvas has come into view (it then stays drawn).
// True once the canvas has come into view (it then stays drawn). The hook also arms the canvas
// (`data-armed`, written straight onto it) once script runs, so the static HTML, and a visit with
// JS off or no IntersectionObserver, shows everything in place; only an armed canvas waits, hidden,
// to be seen.
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen || typeof IntersectionObserver === 'undefined') return;
    el.setAttribute('data-armed', '');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

export function PromiseCanvas() {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [hot, setHot] = useState<PromiseId | null>(null);
  return (
    <section aria-labelledby="promises-heading" className="relative">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            No catch
          </p>
          <h2
            id="promises-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100"
          >
            Built with your values in mind
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            livediagram is free, open and private for everyone, and it stays that way.
          </p>
        </div>

        {/* The canvas: the editor's paper and dot grid, in a soft frame. */}
        <div
          ref={ref}
          data-seen={seen ? '' : undefined}
          className="promise-canvas relative mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-(--art-paper) bg-[radial-gradient(circle_at_center,_var(--art-grid)_1px,_transparent_1px)] bg-[size:24px_24px] p-5 shadow-xl shadow-brand-500/5 sm:p-8 lg:h-[600px] lg:p-0 dark:border-slate-800"
        >
          {/* Connectors (wide canvas only), drawn in the layout box's own units. */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
            viewBox={`0 0 ${BOX.w} ${BOX.h}`}
            preserveAspectRatio="none"
          >
            {PROMISES.map((p, i) => {
              const d = connectorPath(p.id);
              const look = LOOK[p.id];
              return (
                <g
                  key={p.id}
                  className="promise-link"
                  data-hot={hot === p.id ? '' : undefined}
                  style={{ '--i': i } as CSSProperties}
                >
                  <path
                    className="promise-link-line"
                    d={d}
                    fill="none"
                    stroke={look.stroke}
                    strokeWidth="2"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    pathLength={1}
                  />
                  <circle
                    className="promise-link-pulse"
                    r="4"
                    fill={look.stroke}
                    style={{ offsetPath: `path('${d}')` } as CSSProperties}
                  />
                </g>
              );
            })}
          </svg>

          {/* The hub. */}
          <div
            className="promise-hub relative z-10 mx-auto flex w-fit items-center gap-3 rounded-2xl border-2 border-brand-400 bg-white px-5 py-3.5 shadow-lg shadow-brand-500/15 lg:absolute lg:left-(--x) lg:top-(--y) lg:mx-0 lg:-translate-x-1/2 lg:-translate-y-1/2 dark:border-brand-500/70 dark:bg-slate-900"
            // Placed only on the wide canvas; in the column it sits in flow.
            style={{ '--x': pct(HUB.x, BOX.w), '--y': pct(HUB.y, BOX.h) } as CSSProperties}
          >
            <Brand size="md" />
            <span className="h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              For everyone
            </span>
          </div>

          {/* The nodes: a column with one line down its left below `lg`, placed round the hub
              above it. */}
          <ul className="promise-nodes relative mt-6 grid gap-4 border-l-2 border-dashed border-slate-300 pl-5 sm:grid-cols-2 lg:absolute lg:inset-0 lg:mt-0 lg:block lg:border-0 lg:pl-0 dark:border-slate-700">
            {PROMISES.map((p, i) => (
              <li
                key={p.id}
                className="promise-node lg:absolute lg:left-(--x) lg:top-(--y) lg:w-[28%] lg:-translate-x-1/2 lg:-translate-y-1/2"
                style={
                  {
                    '--i': i,
                    '--x': pct(LOOK[p.id].at.x, BOX.w),
                    '--y': pct(LOOK[p.id].at.y, BOX.h),
                  } as CSSProperties
                }
                onPointerEnter={() => setHot(p.id)}
                onPointerLeave={() => setHot((h) => (h === p.id ? null : h))}
                onFocus={() => setHot(p.id)}
                onBlur={() => setHot((h) => (h === p.id ? null : h))}
              >
                <PromiseNode promise={p} />
              </li>
            ))}
          </ul>

          {/* A teammate, live: their cursor drifts across the open canvas. */}
          <span
            aria-hidden
            className="promise-cursor pointer-events-none absolute z-20 hidden lg:block"
            style={{ left: pct(240, BOX.w), top: pct(246, BOX.h) }}
          >
            <CollaboratorPointer color="#ec4899" />
            <span className="absolute left-3.5 top-3.5 whitespace-nowrap rounded-md bg-pink-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              Jo is here
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

// One promise: a node on the canvas. Selected on hover or focus, with the editor's handles in its
// hue. A node with more to read is a link.
function PromiseNode({ promise: p }: { promise: Promise }) {
  const look = LOOK[p.id];
  const { Icon } = look;
  const body = (
    <>
      {/* The editor's selection: an outline and four handles, in the node's hue. */}
      <span
        aria-hidden
        className="promise-select pointer-events-none absolute -inset-1.5 rounded-[1.1rem] border-2"
        style={{ borderColor: look.stroke }}
      >
        {(
          ['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1'] as const
        ).map((pos) => (
          <span
            key={pos}
            className={`absolute h-2 w-2 rounded-[2px] border-2 bg-white ${pos}`}
            style={{ borderColor: look.stroke }}
          />
        ))}
      </span>
      <span className="flex items-center gap-3">
        <span
          className={`promise-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${look.chip}`}
        >
          <Icon size={18} aria-hidden />
        </span>
        <span className={`text-2xl font-bold tracking-tight tabular-nums ${look.value}`}>
          {p.value}
        </span>
        {p.id === 'live' ? (
          <span className="relative ml-auto flex h-2.5 w-2.5" aria-hidden>
            <span className="promise-live-ping absolute inline-flex h-full w-full rounded-full bg-violet-400" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-500" />
          </span>
        ) : null}
      </span>
      <span className="mt-3 block font-semibold text-slate-900 dark:text-slate-100">{p.title}</span>
      <span className="mt-1 block text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {p.line}
      </span>
      {p.link ? (
        <span className={`mt-3 inline-flex items-center gap-1 text-sm font-semibold ${look.value}`}>
          {p.link.label}
          <ChevronRightIcon size={14} aria-hidden className="promise-arrow" />
        </span>
      ) : null}
    </>
  );
  const card =
    'promise-card relative block rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900';
  return p.link ? (
    <a
      href={p.link.href}
      {...(p.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`${card} focus-visible:outline-none`}
    >
      {body}
    </a>
  ) : (
    <div className={card}>{body}</div>
  );
}
