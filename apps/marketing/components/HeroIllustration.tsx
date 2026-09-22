'use client';

// Animated hero: three editor windows on a sliding stage.
//   1. Flowchart — shared, a teammate cursor, a comment thread, and the
//      theme-recolour beat (the only window that recolours; its canvas tints
//      to match).
//   2. Mind map — shared, a Highlighter swipe across one node, then a laser
//      pointer that rings one node then another.
//   3. Release timeline — private (amber badge, just you, no collaborators),
//      with the Layers panel docked beside it.
// The chrome mirrors today's editor: the Editor menu and Share button in the
// header, the tabbed palette with its search box and labelled tiles, the zoom
// cluster, and the bottom tab bar's toolbelt. Below the stage, a label names
// the centred window and a row of dots moves between them.
// The centred window plays its pure-CSS build (globals.css, hero-*); the
// peeking windows render settled (.hero-static), blurred + faded, with the
// stage edges masked so they fade out rather than hard-clip. The stage
// auto-advances every 16s and centres a window when clicked (timer resets on
// interaction). Windows are wider on mobile (less peek, more legible).
//
// It's the page's third 'use client' boundary; with JS off it renders the
// first window centred, and reduced-motion settles every build, the canvas
// tint, and hides the laser.

import { useEffect, useState, type ReactNode } from 'react';
import { Brand } from '@livediagram/ui';
import { FlowchartDiagram, MindMapDiagram, TimelineDiagram, type Theme } from './hero-diagrams';

// Geometry: each window is `card`% of the stage with a GAP% gutter, so the
// centred window sits at translateX = (100 - card) / 2 - i * (card + GAP).
// `card` is wider on mobile so the windows stay legible there.
const CARD_WIDE = 68;
const CARD_NARROW = 88;
const GAP = 3;

type TabDef = { name: string; color: string; active?: boolean };

// Each window sits on its own themed canvas. The flowchart animates between
// these two (the recolour beat, via the hero-theme / hero-theme-canvas
// keyframes); the others hold a single distinct theme.
const FLOW_REST = '#eff6ff'; // blue-50 resting tint of the flowchart canvas
const VIOLET: Theme = { canvas: '#f5f3ff', fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95' };
const AMBER: Theme = { canvas: '#fffbeb', fill: '#fef3c7', stroke: '#b45309', text: '#78350f' };

const CARDS: {
  key: string;
  title: string;
  // What the dot navigation says about this window while it is centred.
  label: string;
  tabs: TabDef[];
  showCursor: boolean;
  shared: boolean;
  theming: boolean;
  canvasTint: string;
  // Dock the Layers panel (spec/74) on this window's canvas.
  layers?: boolean;
}[] = [
  {
    key: 'flowchart',
    title: 'Quarterly planning',
    label: 'A flowchart, shared live, recoloured with one click',
    tabs: [
      { name: 'Overview', color: '#0ea5e9', active: true },
      { name: 'Roadmap', color: '#ec4899' },
      { name: 'Launch', color: '#8b5cf6' },
    ],
    showCursor: true,
    shared: true,
    theming: true,
    canvasTint: FLOW_REST,
  },
  {
    key: 'mindmap',
    title: 'Team mind map',
    label: 'A mind map, highlighted and laser-pointed for the room',
    tabs: [
      { name: 'Ideas', color: '#0ea5e9', active: true },
      { name: 'Themes', color: '#ec4899' },
      { name: 'Actions', color: '#8b5cf6' },
    ],
    showCursor: false,
    shared: true,
    theming: false,
    canvasTint: VIOLET.canvas,
  },
  {
    key: 'timeline',
    title: 'Release timeline',
    label: 'A private timeline, organised into layers',
    tabs: [
      { name: 'Roadmap', color: '#0ea5e9', active: true },
      { name: 'Milestones', color: '#ec4899' },
      { name: 'Releases', color: '#8b5cf6' },
    ],
    showCursor: false,
    shared: false,
    theming: false,
    canvasTint: AMBER.canvas,
    layers: true,
  },
];

// The palette mock's Favourites grid: the editor's default go-to tiles.
const PALETTE_TILES: { kind: string; label: string }[] = [
  { kind: 'rect', label: 'Square' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'text', label: 'Text' },
  { kind: 'arrow', label: 'Arrow' },
  { kind: 'frame', label: 'Frame' },
  { kind: 'note', label: 'Note' },
  { kind: 'image', label: 'Image' },
  { kind: 'pen', label: 'Shape Pen' },
];

// The Layers panel rows on the timeline window.
const LAYER_ROWS: { name: string; swatch: string; hidden: boolean }[] = [
  { name: 'Milestones', swatch: '#f59e0b', hidden: false },
  { name: 'Axis', swatch: '#b45309', hidden: false },
  { name: 'Notes', swatch: '#94a3b8', hidden: true },
];

// Window width as a % of the stage: narrower peek (wider window) on phones.
function useCardWidth() {
  const [card, setCard] = useState(CARD_WIDE);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const apply = () => setCard(mq.matches ? CARD_WIDE : CARD_NARROW);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return card;
}

export function HeroIllustration() {
  const [active, setActive] = useState(0);
  const card = useCardWidth();

  // Auto-advance one window per build cycle; reset whenever `active` changes
  // (so a click gives the clicked window a full cycle). Skipped under reduced
  // motion.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % CARDS.length), 16000);
    return () => window.clearInterval(id);
  }, [active]);

  const tx = (100 - card) / 2 - active * (card + GAP);

  const current = CARDS[active] ?? CARDS[0]!;
  return (
    <div className="mx-auto mt-16 w-full max-w-6xl">
      <div
        aria-hidden
        className="w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
      >
        <div
          className="hero-track flex w-full"
          style={{ gap: `${GAP}%`, transform: `translateX(${tx}%)` }}
        >
          {CARDS.map((c, i) => {
            const playing = i === active;
            const diagram =
              c.key === 'mindmap' ? (
                <MindMapDiagram playing={playing} theme={VIOLET} />
              ) : c.key === 'timeline' ? (
                <TimelineDiagram theme={AMBER} />
              ) : (
                <FlowchartDiagram />
              );
            return (
              <button
                key={c.key}
                type="button"
                tabIndex={-1}
                onClick={() => setActive(i)}
                style={{ width: `${card}%` }}
                className={
                  'shrink-0 text-left transition duration-500 ' +
                  (playing ? '' : 'scale-[0.97] opacity-60 blur-[2px]')
                }
              >
                <EditorWindow
                  title={c.title}
                  tabs={c.tabs}
                  shared={c.shared}
                  theming={c.theming}
                  canvasTint={c.canvasTint}
                  showCursor={c.showCursor}
                  layers={c.layers ?? false}
                  playing={playing}
                  diagram={diagram}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Dot navigation: a label for the centred window, and one dot per
          window so a visitor moves between them at their own pace (the
          auto-advance timer resets on each choice). */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-sm text-slate-500" aria-live="polite">
          {current.label}
        </p>
        <div className="flex items-center gap-2" role="group" aria-label="Hero examples">
          {CARDS.map((c, i) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={
                'h-2 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ' +
                (i === active ? 'w-7 bg-brand-500' : 'w-2 bg-slate-300 hover:bg-slate-400')
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// One editor-window mock: shared chrome plus a caller-supplied SVG diagram.
// The diagram group is keyed on `playing` so its build animation restarts each
// time the window reaches centre; off-centre it gets .hero-static (settled).
function EditorWindow({
  title,
  tabs,
  diagram,
  playing,
  shared,
  theming,
  canvasTint,
  showCursor,
  layers,
}: {
  title: string;
  tabs: TabDef[];
  diagram: ReactNode;
  playing: boolean;
  shared: boolean;
  theming: boolean;
  canvasTint: string;
  showCursor: boolean;
  layers: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-brand-500/10">
      <div className="overflow-hidden rounded-lg border border-slate-100">
        {/* Editor header strip (static chrome) */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            <Brand size="sm" />
            {/* The Editor menu, as the real header carries it. */}
            <span className="hidden items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 sm:inline-flex">
              <MenuGlyph />
              Editor
              <ChevronGlyph />
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-xs text-slate-400 sm:inline">{title}</span>
            {shared ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
                <span className="text-emerald-500">
                  <SharedDotIcon />
                </span>
                Shared
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                <span className="text-amber-500">
                  <PrivateDotIcon />
                </span>
                Private
              </span>
            )}
          </div>
          {/* Share, then presence: a shared diagram shows collaborators; a
              private one shows only you. */}
          <div className="flex items-center gap-1.5">
            <span className="mr-1 hidden items-center gap-1 rounded-md bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white sm:inline-flex">
              <ShareGlyph />
              Share
            </span>
            <Avatar initials="TM" color="#0ea5e9" />
            {shared ? <Avatar initials="JR" color="#ec4899" /> : null}
          </div>
        </div>

        {/* Canvas surface. Each window has its own themed canvas tint; the
            flowchart additionally animates blue→green (overriding the resting
            tint) while it is centred. */}
        <div
          style={{ backgroundColor: canvasTint }}
          className={
            'relative h-[300px] bg-[radial-gradient(circle_at_center,_#cbd5e1_1.2px,_transparent_1.2px)] bg-[size:24px_24px] sm:h-[360px]' +
            (theming && playing ? ' hero-theme-canvas' : '')
          }
        >
          {/* Floating palette mockup (static chrome), as the editor's: the
              tool + category pickers, the element search, and the Favourites
              grid of labelled tiles. */}
          <div className="absolute right-2 top-2 hidden w-40 flex-col rounded-lg border border-slate-200 bg-white shadow-md sm:flex">
            <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
                Palette
              </p>
              <span className="flex gap-1 text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1 text-[9px] font-medium text-slate-600">
              <span className="inline-flex items-center gap-0.5">
                Select
                <ChevronGlyph />
              </span>
              <span className="inline-flex items-center gap-0.5">
                <StarGlyph />
                Favourites
                <ChevronGlyph />
              </span>
            </div>
            <div className="px-1.5 pt-1.5">
              <div className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[8px] text-slate-400">
                Search all elements
              </div>
            </div>
            <div className="grid grid-cols-3 gap-0.5 p-1.5">
              {PALETTE_TILES.map((t) => (
                <span
                  key={t.kind}
                  className="flex flex-col items-center gap-0.5 rounded py-0.5 text-slate-500"
                >
                  <Shape kind={t.kind} />
                  <span className="text-[7px] leading-none text-slate-500">{t.label}</span>
                </span>
              ))}
            </div>
          </div>

          {/* The Layers panel (spec/74), docked on the timeline window: one
              row per layer with its eye toggle, the hidden one dimmed. */}
          {layers ? (
            <div className="absolute left-2 top-2 hidden w-32 flex-col rounded-lg border border-slate-200 bg-white shadow-md sm:flex">
              <p className="border-b border-slate-100 px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500">
                Layers
              </p>
              {LAYER_ROWS.map((row) => (
                <span
                  key={row.name}
                  className={
                    'flex items-center gap-1.5 px-2 py-1 text-[9px] font-medium ' +
                    (row.hidden ? 'text-slate-300' : 'text-slate-600')
                  }
                >
                  <EyeGlyph off={row.hidden} />
                  <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: row.swatch }} />
                  {row.name}
                </span>
              ))}
            </div>
          ) : null}

          {/* Zoom cluster (static chrome): history, undo / redo, layers, the
              look-and-feel brush, and the zoom readout. */}
          <div className="absolute bottom-2 right-2 hidden items-center gap-1 text-slate-500 sm:flex">
            <span className="flex items-center rounded-md border border-slate-200 bg-white shadow-sm">
              <ToolGlyph kind="history" />
              <ToolGlyph kind="undo" />
              <ToolGlyph kind="redo" />
            </span>
            <span className="flex items-center rounded-md border border-slate-200 bg-white shadow-sm">
              <ToolGlyph kind="layers" />
            </span>
            <span className="flex items-center rounded-md border border-slate-200 bg-white shadow-sm">
              <ToolGlyph kind="brush" />
            </span>
            <span className="flex items-center rounded-md border border-slate-200 bg-white px-1 text-[10px] font-medium shadow-sm">
              <span className="px-1">−</span>
              100%
              <span className="px-1">+</span>
            </span>
          </div>

          {/* The diagram centres in the canvas left clear by the palette (and
              the Layers panel when docked), so no node sits under a panel. */}
          <svg
            className={
              'absolute inset-y-0 left-0 right-0 h-full sm:right-44 ' + (layers ? 'sm:left-36' : '')
            }
            style={{ width: 'auto' }}
            viewBox="0 -60 600 400"
            preserveAspectRatio="xMidYMid meet"
          >
            <g key={playing ? 'play' : 'idle'} className={playing ? undefined : 'hero-static'}>
              {diagram}
            </g>
          </svg>

          {/* Remote collaborator's cursor sweeping the canvas (flowchart card
              only; the mind-map card uses an in-canvas laser pointer, the
              private timeline has no collaborators). */}
          {showCursor && playing ? (
            <span className="hero-cursor pointer-events-none absolute" aria-hidden>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="#ec4899"
                stroke="white"
                strokeWidth="1"
              >
                <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
              </svg>
              <span
                className="absolute -top-3 left-3 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: '#ec4899' }}
              >
                JR
              </span>
            </span>
          ) : null}
        </div>

        {/* Bottom tab bar (static chrome): colour-coded tabs relevant to this
            diagram + the toolbelt the page advertises. */}
        <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-2 py-2">
          <span
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
            aria-hidden
          >
            <TabsLabelIcon />
            Tabs
          </span>
          <div className="flex min-w-0 items-center gap-1">
            {tabs.map((t) => (
              <span
                key={t.name}
                style={{ color: t.color, ...(t.active ? { backgroundColor: `${t.color}1a` } : {}) }}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                <span className={t.active ? '' : 'text-slate-500'}>{t.name}</span>
                {t.active ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <circle cx="3" cy="7" r="1.25" fill="currentColor" />
                    <circle cx="7" cy="7" r="1.25" fill="currentColor" />
                    <circle cx="11" cy="7" r="1.25" fill="currentColor" />
                  </svg>
                ) : null}
              </span>
            ))}
            <span className="px-1 text-base leading-none text-slate-400">+</span>
          </div>
          {/* Toolbelt: hidden on mobile (it clashes with the tabs in the
              narrower windows), shown from sm up. */}
          <div className="ml-auto hidden items-center gap-1 text-slate-400 sm:flex">
            <ToolGlyph kind="search" />
            <ToolGlyph kind="keys" />
            <ToolGlyph kind="sliders" />
            <ToolGlyph kind="moon" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      style={{ backgroundColor: color, boxShadow: '0 0 0 2px white, 0 0 0 4px #22c55e' }}
      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
    >
      {initials}
    </span>
  );
}

// Tab-bar "Tabs" label icon, mirroring apps/live/components/TabBar.tsx.
function TabsLabelIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 4.5h3l1 1.25h5v4.25h-9z" />
      <path d="M3 4.5V3h3.25" />
    </svg>
  );
}

// Connected-nodes glyph for the header "Shared" badge, mirroring
// EditorHeader's SharedDotIcon.
function SharedDotIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="2" cy="4.5" r="1.4" />
      <circle cx="7" cy="2" r="1.2" />
      <circle cx="7" cy="7" r="1.2" />
      <path d="M3.2 3.8L5.9 2.5M3.2 5.2L5.9 6.5" />
    </svg>
  );
}

// Padlock glyph for the header "Private" badge, mirroring EditorHeader's
// PrivateDotIcon.
function PrivateDotIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="5" height="3.5" rx="0.8" />
      <path d="M3.25 4V3a1.25 1.25 0 0 1 2.5 0v1" />
    </svg>
  );
}

// Small chrome glyphs: the bottom tab bar's toolbelt (search, keyboard
// shortcuts, settings, dark-mode) and the zoom cluster (history, undo, redo,
// layers, brush). Decorative, sized for the chrome.
function ToolGlyph({
  kind,
}: {
  kind: 'search' | 'keys' | 'sliders' | 'moon' | 'history' | 'undo' | 'redo' | 'layers' | 'brush';
}) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  } as const;
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-md">
      {kind === 'search' ? (
        <svg {...common}>
          <circle cx="7" cy="7" r="4" />
          <path d="M10 10l3.5 3.5" />
        </svg>
      ) : kind === 'keys' ? (
        <svg {...common}>
          <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
          <path d="M4 7h.01M7 7h.01M10 7h.01M5 9.5h6" />
        </svg>
      ) : kind === 'sliders' ? (
        <svg {...common}>
          <path d="M2 5h12M2 11h12" />
          <circle cx="6" cy="5" r="1.6" fill="white" />
          <circle cx="10.5" cy="11" r="1.6" fill="white" />
        </svg>
      ) : kind === 'history' ? (
        <svg {...common}>
          <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
          <path d="M2.5 3v3h3M8 5.5V8l2 1.5" />
        </svg>
      ) : kind === 'undo' ? (
        <svg {...common}>
          <path d="M6 4 3 7l3 3" />
          <path d="M3 7h6.5a3.5 3.5 0 0 1 0 7H7" />
        </svg>
      ) : kind === 'redo' ? (
        <svg {...common}>
          <path d="M10 4l3 3-3 3" />
          <path d="M13 7H6.5a3.5 3.5 0 0 0 0 7H9" />
        </svg>
      ) : kind === 'layers' ? (
        <svg {...common}>
          <path d="M8 2.5 14 5.5 8 8.5 2 5.5z" strokeLinejoin="round" />
          <path d="M2 8.5l6 3 6-3M2 11.5l6 3 6-3" />
        </svg>
      ) : kind === 'brush' ? (
        <svg {...common}>
          <path d="M13.5 2.5 7 9l-1 1 .5 .5 1-1 6.5-6.5z" strokeLinejoin="round" />
          <path d="M6 10c-1.5 0-2.5 1-2.5 2.5S2 14 2 14s2 .2 3.5-1S6 10 6 10z" />
        </svg>
      ) : (
        <svg {...common}>
          <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" />
        </svg>
      )}
    </span>
  );
}

function Shape({ kind }: { kind: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'rect':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="10" height="10" rx="2" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...common}>
          <polygon points="8,3 13,8 8,13 3,8" strokeLinejoin="round" />
        </svg>
      );
    case 'cyl':
      return (
        <svg {...common}>
          <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" strokeLinejoin="round" />
          <ellipse cx="8" cy="5" rx="5" ry="1.5" />
        </svg>
      );
    case 'para':
      return (
        <svg {...common}>
          <polygon points="4,3 13,3 12,13 3,13" strokeLinejoin="round" />
        </svg>
      );
    case 'hex':
      return (
        <svg {...common}>
          <polygon points="4,3 11,3 14,8 11,13 4,13 1,8" strokeLinejoin="round" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path
            d="M3 3 L13 3 L13 12 C11 13.4 9.5 11.5 8 12.6 C6.5 13.7 5 11.5 3 12.6 Z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'pill':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="12" height="6" rx="3" />
        </svg>
      );
    case 'text':
      return (
        <svg {...common} strokeLinecap="round">
          <path d="M3.5 4h9M8 4v9M6 13h4" />
        </svg>
      );
    case 'arrow':
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h9M9 4.5 12.5 8 9 11.5" />
        </svg>
      );
    case 'frame':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3 5.5V13h10V5.5M3 5.5V3h4l1 2.5h5" />
        </svg>
      );
    case 'note':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3 3h10v6l-4 4H3z" />
          <path d="M9 13V9h4" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common} strokeLinejoin="round">
          <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
          <path d="M2.5 11l3.5-3.5 3 3 2-2 2.5 2.5" />
          <circle cx="10.5" cy="6" r="1" />
        </svg>
      );
    case 'pen':
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13c1-4 3-6 6-8l2 2c-2 3-4 5-8 6z" />
          <path d="M9 5l2 2" />
        </svg>
      );
  }
  return null;
}

function MenuGlyph() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 3h8M2 6h8M2 9h8" />
    </svg>
  );
}

function ChevronGlyph() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

function StarGlyph() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 1.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1L6 8.6 3.2 10.1l.6-3.1L1.5 4.8l3.1-.4z" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 7.5V1.5M3.5 4 6 1.5 8.5 4" />
      <path d="M2.5 6.5v3.5h7V6.5" />
    </svg>
  );
}

function EyeGlyph({ off }: { off: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
      {off ? <path d="M2.5 13.5l11-11" /> : null}
    </svg>
  );
}
