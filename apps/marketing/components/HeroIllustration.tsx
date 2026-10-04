'use client';

// Animated hero: six editor windows on a sliding stage (docs/specs/019-marketing/marketing-site.md
// "Hero"), the launch window then one per editor mode, each showing its mode in action.
//   1. Your canvas — the launch window (hero-launch.tsx): a fresh, empty,
//      private document. While centred, a click grows it to fill the screen
//      and lands on a new blank document with Quick Start open.
//   2. Diagram — two people map a sign-up flow in a frame: steps dropped and labelled, arrows
//      joined, a branch and a loop added by a teammate, a step snapped onto an alignment guide and
//      coloured, a sticky question and a database wired in (hero-diagram-board.tsx).
//   3. Draw — a retro whiteboard: a title underlined in marker, stickies, the highlighter, a
//      teammate's blue marker ringing the best note, and a doodle (hero-draw-board.tsx).
//   4. Mind map — a launch plan grown from the centre: four colour-coded branches on tapered
//      curves, ideas sprouting on underlines as Tab and Enter add them, a teammate filling a
//      branch, a rocket sticker (hero-mindmap-board.tsx).
//   5. Infographic (Illustrate mode) — two pages laid out side by side: stats, a growing bar
//      chart and a filling donut on one, a roadmap and a pull quote on the next
//      (hero-illustrate-page.tsx).
//   6. Article (Illustrate mode) — an article page written line by line, with a header image, a
//      heading and a pull quote, and a phrase set in bold from the rich-text toolbar
//      (hero-article-page.tsx).
// Every window is in the Toolbar panel layout, its strip wearing its mode: the mode switch and
// the mode's tiles (hero-mode-palette.tsx), and the glyph on its tab. Below the stage, a label names the centred window and a row of dots
// moves between them.
// The centred window plays its pure-CSS build (hero-animations.css, hero-mode-animations.css);
// the peeking windows render settled (.hero-static), blurred + faded, with the stage edges masked
// so they fade out rather than hard-clip. The stage auto-advances every 16s (the launch window
// holds for 32s) and centres a window when clicked (timer resets on interaction). Every window
// ends the same way: over its last second it fades to a light grey, the stage moves on, and the
// next window lifts from that grey (hero-fade). On a phone the windows are tall, each scene in its
// own portrait layout, and wider (less peek, more legible).
//
// With JS off it renders the first window centred, and reduced motion settles every build.

import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PREFERS_REDUCED_MOTION,
  useMediaQuery,
} from '@livediagram/ui';
import { DiagramBoard } from './hero-diagram-board';
import { DrawBoard } from './hero-draw-board';
import { ArticlePage } from './hero-article-page';
import { InfographicPages } from './hero-illustrate-page';
import { MindMapBoard } from './hero-mindmap-board';
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
// Kept in step with the stage's --hero-card (92 / sm:68), the same widths for the first paint.
const CARD_WIDE = 68;
const CARD_NARROW = 92;
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
  shared: boolean;
  // The launch window: a link that grows into a new document (hero-launch.tsx).
  launch?: boolean;
}[] = [
  {
    key: 'launch',
    title: LAUNCH_TITLE,
    label: 'A fresh canvas of your own: click it to start drawing',
    mode: 'diagram',
    tabs: [{ name: LAUNCH_TAB, color: '#0ea5e9', active: true }],
    shared: false,
    launch: true,
  },
  {
    key: 'diagram',
    title: 'Onboarding',
    label: 'Diagram: map a flow together, with arrows that connect and shapes that snap',
    mode: 'diagram',
    tabs: [
      { name: 'Sign-up', color: '#0ea5e9', active: true },
      { name: 'Checkout', color: '#ec4899' },
      { name: 'Billing', color: '#8b5cf6' },
    ],
    shared: true,
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
    shared: true,
  },
  {
    key: 'mindmap',
    title: 'Launch plan',
    label: 'Mind map: grow ideas out from the centre, one Tab at a time',
    mode: 'diagram',
    tabs: [
      { name: 'Ideas', color: '#0ea5e9', active: true },
      { name: 'Actions', color: '#10b981' },
    ],
    shared: true,
  },
  {
    key: 'infographic',
    title: 'Year in review',
    label: 'Infographic: lay out pages of numbers, charts and quotes, ready to print or share',
    mode: 'illustrate',
    tabs: [{ name: 'Infographic', color: '#8b5cf6', active: true }],
    shared: true,
  },
  {
    key: 'article',
    title: 'Field notes',
    label: 'Article: write long reads on pages, with images, headings and pull quotes',
    mode: 'illustrate',
    tabs: [{ name: 'Draft', color: '#0ea5e9', active: true }],
    shared: true,
  },
];

// Window width as a % of the stage, for the whole-pixel snap: narrower peek (wider window) on
// phones. It only matters once the stage is measured (after hydration, when the media query is
// true to the device); the first paint takes the same numbers from CSS (--hero-card).
// A phone: narrower peek, wider windows, and each window's portrait layout.
const PHONE = '(max-width: 639px)';

// The portrait viewBox a phone draws each window's layout in: taller than wide, the pages' windows
// taller still so two pages stack.
const PORTRAIT_VIEWBOX: Record<string, string> = {
  diagram: '0 -40 360 520',
  draw: '0 -40 360 520',
  mindmap: '0 -40 360 520',
  infographic: '10 -40 360 680',
  article: '10 -40 360 680',
};

export function HeroIllustration() {
  const [active, setActive] = useState(0);
  // Until the stage first moves, the launch window is on its page-load play, where its flow waits
  // for the headline's connector to land.
  const [moved, setMoved] = useState(false);
  const show = (i: number) => {
    setActive(i);
    setMoved(true);
  };
  const portrait = useMediaQuery(PHONE);
  const card = portrait ? CARD_NARROW : CARD_WIDE;

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
  // breakpoint (--hero-card on the stage: 92 on a phone, 68 from sm), so a phone paints its own
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
    // On a phone the stage reaches nearer the screen edges, so the window has the room.
    <div className="-mx-4 mt-16 w-[calc(100%+2rem)] sm:mx-auto sm:w-full sm:max-w-6xl">
      <div className="relative [--arrow-clear:0px] [--hero-card:92] sm:[--arrow-clear:20px] sm:[--hero-card:68]">
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
                <DrawBoard portrait={portrait} />
              ) : c.key === 'mindmap' ? (
                <MindMapBoard portrait={portrait} />
              ) : c.key === 'article' ? (
                <ArticlePage portrait={portrait} />
              ) : c.key === 'infographic' ? (
                <InfographicPages portrait={portrait} />
              ) : (
                <DiagramBoard portrait={portrait} />
              );
              const frame = (
                <EditorWindow
                  title={c.title}
                  tabs={c.tabs}
                  shared={c.shared}
                  mode={c.mode}
                  playing={playing}
                  document={liveDoc}
                  viewBox={portrait ? PORTRAIT_VIEWBOX[c.key] : undefined}
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
