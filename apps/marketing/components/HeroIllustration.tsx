'use client';

// Animated hero: four editor windows on a sliding stage (docs/specs/019-marketing/marketing-site.md
// "Hero"), the launch window then one per editor mode, each showing its mode in action.
//   1. Your canvas — the launch window (hero-launch.tsx): a fresh, empty,
//      private document. While centred, a click grows it to fill the screen
//      and lands on a new blank document with Quick Start open.
//   2. Diagram — a flowchart built, shared with a teammate's cursor, renamed, and restyled in a
//      click: the Tab Look & Feel dialog opens, a theme card is picked, and it recolours.
//   3. Draw — a retro whiteboard: a title underlined in marker, stickies, the highlighter, a
//      teammate's blue marker ringing the best note, and a doodle (hero-draw-board.tsx).
//   4. Illustrate — an infographic page laid out: a band and title, a headline number, stat
//      chips, a growing bar chart and a filling donut, then a teammate selects the chart
//      (hero-illustrate-page.tsx).
// Every window is in the Toolbar panel layout, its strip wearing its mode: the mode switch and
// the mode's tiles (hero-mode-palette.tsx), and the glyph on its tab. Below the stage, a label names the centred window and a row of dots
// moves between them.
// The centred window plays its pure-CSS build (hero-animations.css, hero-mode-animations.css);
// the peeking windows render settled (.hero-static), blurred + faded, with the stage edges masked
// so they fade out rather than hard-clip. The stage auto-advances every 16s (the launch window
// holds for 32s) and centres a window when clicked (timer resets on interaction). Every window
// ends the same way: over its last second it fades to a light grey, the stage moves on, and the
// next window lifts from that grey (hero-fade). Windows are wider on mobile (less peek, more
// legible).
//
// With JS off it renders the first window centred, and reduced motion settles every build.

import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PREFERS_REDUCED_MOTION,
  useMediaQuery,
} from '@livediagram/ui';
import { FlowchartDiagram } from './hero-diagrams';
import { DrawBoard } from './hero-draw-board';
import { IllustratePage } from './hero-illustrate-page';
import type { HeroMode } from './hero-mode-palette';
import { snapStage } from '@/lib/hero-stage';
import { EditorWindow, type TabDef } from './hero-editor-window';
import { useStageBox } from './useStageBox';
import {
  LAUNCH_DWELL_MS,
  LAUNCH_HREF,
  LAUNCH_TAB,
  LAUNCH_TITLE,
  LaunchCanvasOverlay,
  prefetchLaunch,
  useLaunchGrow,
} from './hero-launch';

// Geometry: each window is `card`% of the stage with a GAP% gutter, so the
// centred window sits at translateX = (100 - card) / 2 - i * (card + GAP).
// `card` is wider on mobile so the windows stay legible there.
// Kept in step with the stage's --hero-card (88 / sm:68), the same widths for the first paint.
const CARD_WIDE = 68;
const CARD_NARROW = 88;
const GAP = 3;

// One build cycle: every window but the launch window plays for this long, and the hero-* build
// and veil keyframes are timed to it.
const CYCLE_MS = 16000;

const CARDS: {
  key: string;
  title: string;
  // What the dot navigation says about this window while it is centred.
  label: string;
  mode: HeroMode;
  tabs: TabDef[];
  showCursor: boolean;
  shared: boolean;
  theming: boolean;
  // The launch window: a link that grows into a new document (hero-launch.tsx).
  launch?: boolean;
}[] = [
  {
    key: 'launch',
    title: LAUNCH_TITLE,
    label: 'A fresh canvas of your own: click it to start drawing',
    mode: 'diagram',
    tabs: [{ name: LAUNCH_TAB, color: '#0ea5e9', active: true }],
    showCursor: false,
    shared: false,
    theming: false,
    launch: true,
  },
  {
    key: 'diagram',
    title: 'Quarterly planning',
    label: 'Diagram: a flowchart built together and restyled in a single click',
    mode: 'diagram',
    tabs: [
      { name: 'Overview', color: '#0ea5e9', active: true },
      { name: 'Roadmap', color: '#ec4899' },
      { name: 'Launch', color: '#8b5cf6' },
    ],
    showCursor: true,
    shared: true,
    theming: true,
  },
  {
    key: 'draw',
    title: 'Sprint retro',
    label: 'Draw: sketch on a whiteboard together, markers, stickies and all',
    mode: 'draw',
    tabs: [
      { name: 'Went well', color: '#10b981', active: true },
      { name: 'To improve', color: '#f59e0b' },
    ],
    showCursor: false,
    shared: true,
    theming: false,
  },
  {
    key: 'illustrate',
    title: 'Year in review',
    label: 'Illustrate: lay out an infographic page, ready to print or share',
    mode: 'illustrate',
    tabs: [{ name: 'Report', color: '#8b5cf6', active: true }],
    showCursor: false,
    shared: true,
    theming: false,
  },
];

// Window width as a % of the stage, for the whole-pixel snap: narrower peek (wider window) on
// phones. It only matters once the stage is measured (after hydration, when the media query is
// true to the device); the first paint takes the same numbers from CSS (--hero-card).
function useCardWidth() {
  return useMediaQuery('(max-width: 639px)') ? CARD_NARROW : CARD_WIDE;
}

export function HeroIllustration() {
  const [active, setActive] = useState(0);
  // Until the stage first moves, the launch window is on its page-load play, where its flow waits
  // for the headline's connector to land.
  const [moved, setMoved] = useState(false);
  const show = (i: number) => {
    setActive(i);
    setMoved(true);
  };
  const card = useCardWidth();

  // Auto-advance one window per build cycle; reset whenever `active` changes
  // (so a click gives the clicked window a full cycle). Skipped under reduced
  // motion (and stops if the visitor turns it on mid-visit).
  const reduceMotion = useMediaQuery(PREFERS_REDUCED_MOTION);
  // The launch window holds longer (LAUNCH_DWELL_MS): it is the one a visitor can step into.
  useEffect(() => {
    if (reduceMotion) return;
    const dwell = CARDS[active]?.launch ? LAUNCH_DWELL_MS : CYCLE_MS;
    const id = window.setTimeout(() => show((active + 1) % CARDS.length), dwell);
    return () => window.clearTimeout(id);
  }, [active, reduceMotion]);

  // Before measurement (the static HTML and the first paint) the window width comes from CSS, by
  // breakpoint (--hero-card on the stage: 88 on a phone, 68 from sm), so a phone paints its own
  // layout from the first frame; a JS media query reads "desktop" in the static HTML, and the
  // window used to paint cramped and then grow.
  const tx = `calc(((100 - var(--hero-card)) / 2 - ${active} * (var(--hero-card) + ${GAP})) * 1%)`;
  // Whole-pixel geometry once the stage is measured (lib/hero-stage.ts), so the centred window's
  // text renders sharp; the percentages above hold until then (and with JS off).
  const stageRef = useRef<HTMLDivElement>(null);
  const box = useStageBox(stageRef);
  const snapped = box ? snapStage(box, card, GAP, active) : null;
  const cardWidth = snapped ? `${snapped.cardPx}px` : 'calc(var(--hero-card) * 1%)';

  const { launch, layer } = useLaunchGrow();

  const current = CARDS[active] ?? CARDS[0]!;
  return (
    <div className="mx-auto mt-16 w-full max-w-6xl">
      <div className="relative [--arrow-clear:0px] [--hero-card:88] sm:[--arrow-clear:20px] sm:[--hero-card:68]">
        <div
          ref={stageRef}
          aria-hidden
          data-hero-anchor="stage"
          className="w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
        >
          <div
            className="hero-track flex w-full"
            style={
              snapped
                ? { gap: `${snapped.gapPx}px`, transform: `translateX(${snapped.translatePx}px)` }
                : { gap: `${GAP}%`, transform: `translateX(${tx})` }
            }
          >
            {CARDS.map((c, i) => {
              const playing = i === active;
              const liveDoc = c.launch ? null : c.mode === 'draw' ? (
                <DrawBoard />
              ) : c.mode === 'illustrate' ? (
                <IllustratePage />
              ) : (
                <FlowchartDiagram />
              );
              const frame = (
                <EditorWindow
                  title={c.title}
                  tabs={c.tabs}
                  shared={c.shared}
                  theming={c.theming}
                  showCursor={c.showCursor}
                  mode={c.mode}
                  playing={playing}
                  document={liveDoc}
                  overlay={
                    c.launch ? (
                      <LaunchCanvasOverlay playing={playing} afterConnector={!moved} />
                    ) : undefined
                  }
                  empty={c.launch ?? false}
                  veil={!c.launch}
                />
              );
              const cardClassName =
                'hero-card-dim shrink-0 text-left ' +
                (playing ? '' : 'scale-[0.97] opacity-60 blur-[2px]');
              // The launch window is a real link (a plain one with JS off): centred, a click grows
              // it into the editor; off-centre, a click centres it like any other window.
              if (c.launch) {
                return (
                  <a
                    key={c.key}
                    href={LAUNCH_HREF}
                    data-hero-anchor="window"
                    tabIndex={-1}
                    onPointerEnter={prefetchLaunch}
                    onClick={(e) => {
                      if (!playing) {
                        e.preventDefault();
                        show(i);
                      } else if (launch(e)) {
                        e.preventDefault();
                      }
                    }}
                    style={{ width: cardWidth }}
                    className={'group block cursor-pointer ' + cardClassName}
                  >
                    {frame}
                  </a>
                );
              }
              return (
                <button
                  key={c.key}
                  type="button"
                  tabIndex={-1}
                  onClick={() => show(i)}
                  style={{ width: cardWidth }}
                  className={cardClassName}
                >
                  {frame}
                </button>
              );
            })}
          </div>
        </div>
        {/* Previous and next, in the gutters either side of the centred window, so the stage reads
          as something to move through. Outside the decorative stage, so they are reachable. */}
        {/* Only where there is somewhere to go: no previous on the first window, no next on the
            last (the auto-advance still wraps round). */}
        {active > 0 ? <StageArrow side="left" onClick={() => show(active - 1)} /> : null}
        {active < CARDS.length - 1 ? (
          <StageArrow side="right" onClick={() => show(active + 1)} />
        ) : null}
      </div>
      {layer}

      {/* Dot navigation: a label for the centred window, and one dot per
          window so a visitor moves between them at their own pace (the
          auto-advance timer resets on each choice). */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
          {current.label}
        </p>
        <div className="flex items-center gap-2" role="group" aria-label="Hero examples">
          {CARDS.map((c, i) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              aria-current={i === active}
              onClick={() => show(i)}
              className={
                'h-2 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ' +
                (i === active
                  ? 'w-7 bg-brand-500'
                  : 'w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600')
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// The centred window's edge (it sits (100 - card) / 2 % in from either side), less a clear space
// (--arrow-clear, set on the stage: 20px from `sm`), so an arrow stands off the window. A phone has
// no room beside the window, so there the arrow sits astride its edge instead.
const EDGE = 'calc((100 - var(--hero-card)) / 2 * 1% - var(--arrow-clear))';

function StageArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous example' : 'Next example'}
      style={side === 'left' ? { left: EDGE } : { right: EDGE }}
      className={`absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-lg shadow-slate-900/10 backdrop-blur transition hover:scale-105 hover:border-brand-300 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:h-11 sm:w-11 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:text-brand-300 ${
        side === 'left'
          ? '-translate-x-1/2 sm:-translate-x-full'
          : 'translate-x-1/2 sm:translate-x-full'
      }`}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
