'use client';

// Animated hero: seven windows on a sliding stage (docs/specs/019-marketing/marketing-site.md
// "Hero"): an overview first, then the modes in action.
//   0. Overview — a bare board (no editor chrome), one named frame per mode window, each drawing
//      its scene settled; pressing a frame moves the stage to that window (hero-overview.tsx).
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
//   7. Town hall — an all-hands on a Q&A board: questions land, votes tick up, the most-voted
//      rises and is answered, reactions float up (hero-townhall-board.tsx).
// Every window is in the Toolbar panel layout, its strip wearing its mode: the mode switch and
// the mode's tiles (hero-mode-palette.tsx), and the glyph on its tab. Below the stage, a label names the centred window and a row of dots
// moves between them.
// The centred window plays its pure-CSS build (hero-animations.css, hero-mode-animations.css);
// the peeking windows render settled (.hero-static), blurred + faded, with the stage edges masked
// so they fade out rather than hard-clip. The stage auto-advances every 22s (the overview holds
// for 24s) and centres a window when clicked (timer resets on interaction). Every window
// ends the same way: over its last second it fades to a light grey, the stage moves on, and the
// next window lifts from that grey (hero-fade). On a phone the windows are tall, each scene in its
// own portrait layout, and wider (less peek, more legible).
//
// With JS off it renders the first window centred, and reduced motion settles every build.

import { ctaHref } from '@livediagram/api-schema';
import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EverythingIcon,
  SparkleIcon,
  PREFERS_REDUCED_MOTION,
  useMediaQuery,
} from '@livediagram/ui';
import { DiagramBoard } from './hero-diagram-board';
import { DrawBoard } from './hero-draw-board';
import { ArticlePage } from './hero-article-page';
import { InfographicPages } from './hero-illustrate-page';
import { MindMapBoard } from './hero-mindmap-board';
import { TownHallBoard } from './hero-townhall-board';
import type { HeroMode } from './hero-mode-palette';
import { snapStage } from '@/lib/hero-stage';
import { pinHeroWord } from '@/lib/hero-word-pin';
import { HeroOverview, type OverviewScene } from './hero-overview';
import { EditorWindow, type TabDef } from './hero-editor-window';
import { useStageBox } from './useStageBox';

// Geometry: each window is `card`% of the stage with a GAP% gutter, so the
// centred window sits at translateX = (100 - card) / 2 - i * (card + GAP).
// `card` is wider on mobile so the windows stay legible there.
// Kept in step with the stage's --hero-card (92 / sm:68), the same widths for the first paint.
const CARD_WIDE = 68;
const CARD_NARROW = 92;
const GAP = 3;

// One build cycle: every mode window plays for this long, and the hero-* build
// and veil keyframes are timed to it.
const CYCLE_MS = 22000;

const CARDS: {
  key: string;
  title: string;
  // What the dot navigation says about this window while it is centred.
  label: string;
  mode: HeroMode;
  tabs: TabDef[];
  shared: boolean;
  // The name its frame carries on the overview (hero-overview.tsx).
  short?: string;
  // The headline's word while this window is centred (lib/hero-word-pin.ts).
  word?: string;
  // Where its Build yours button goes: the template step narrowed to this kind
  // (docs/specs/007-editor/new-document-route.md "?mode= and ?q=").
  build?: string;
  // The overview: every window after it as a frame, each opening its window (hero-overview.tsx).
  overview?: boolean;
}[] = [
  {
    key: 'overview',
    title: 'Everything you can make',
    label: 'Every way to work, on one canvas: pick one to see it in action',
    mode: 'diagram',
    tabs: [{ name: 'Overview', color: '#0ea5e9', active: true }],
    shared: true,
    overview: true,
  },
  {
    key: 'diagram',
    word: 'Diagram',
    build: '/new?mode=diagram',
    short: 'Diagram',
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
    word: 'Whiteboard',
    build: '/new?mode=draw',
    short: 'Draw',
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
    word: 'Brainstorm',
    build: '/new?mode=diagram&q=mind%20map',
    short: 'Mind map',
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
    word: 'Illustrate',
    build: '/new?mode=illustrate',
    short: 'Infographic',
    title: 'Year in review',
    label: 'Infographic: lay out pages of numbers, charts and quotes, ready to print or share',
    mode: 'illustrate',
    tabs: [{ name: 'Infographic', color: '#8b5cf6', active: true }],
    shared: true,
  },
  {
    key: 'article',
    word: 'Document',
    build: '/new?mode=illustrate&q=article',
    short: 'Article',
    title: 'Field notes',
    label: 'Article: write long reads on pages, with images, headings and pull quotes',
    mode: 'illustrate',
    tabs: [{ name: 'Draft', color: '#0ea5e9', active: true }],
    shared: true,
  },
  {
    key: 'townhall',
    word: 'Workshop',
    short: 'Town hall',
    build: '/new?mode=diagram&q=town%20hall',
    title: 'Q3 all-hands',
    label: 'Town hall: questions in, votes up, answered live with the whole room',
    mode: 'diagram',
    tabs: [
      { name: 'Q&A', color: '#ef4444', active: true },
      { name: 'Agenda', color: '#0ea5e9' },
    ],
    shared: true,
  },
];

// The overview's frames: every window that shows a mode at work.
const OVERVIEW_SCENES: OverviewScene[] = CARDS.filter((c) => c.short).map((c) => ({
  key: c.key,
  label: c.short!,
  mode: c.mode,
}));

// The overview holds longer than a build cycle: it is where a visitor picks what to watch.
const OVERVIEW_DWELL_MS = 24000;

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
  townhall: '0 -40 360 520',
};

export function HeroIllustration() {
  const [active, setActive] = useState(0);
  const show = (i: number) => {
    setActive(i);
  };
  const portrait = useMediaQuery(PHONE);
  const card = portrait ? CARD_NARROW : CARD_WIDE;

  // Auto-advance one window per build cycle; reset whenever `active` changes
  // (so a click gives the clicked window a full cycle). Skipped under reduced
  // motion (and stops if the visitor turns it on mid-visit).
  const reduceMotion = useMediaQuery(PREFERS_REDUCED_MOTION);
  // The overview holds longer (OVERVIEW_DWELL_MS): it is where a visitor picks what to watch.
  useEffect(() => {
    if (reduceMotion) return;
    const card = CARDS[active];
    const dwell = card?.overview ? OVERVIEW_DWELL_MS : CYCLE_MS;
    const id = window.setTimeout(() => show((active + 1) % CARDS.length), dwell);
    return () => window.clearTimeout(id);
  }, [active, reduceMotion]);

  // The headline holds the centred window's word; the overview lets it cycle.
  useEffect(() => {
    pinHeroWord(CARDS[active]?.word ?? null);
  }, [active]);
  useEffect(() => () => pinHeroWord(null), []);

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
              const liveDoc = c.overview ? null : c.mode === 'draw' ? (
                <DrawBoard portrait={portrait} />
              ) : c.key === 'townhall' ? (
                <TownHallBoard portrait={portrait} />
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
                  overlay={c.build ? <BuildYours href={c.build} live={playing} /> : undefined}
                />
              );
              const cardClassName =
                'hero-card-dim shrink-0 text-left ' +
                (playing ? '' : 'scale-[0.97] opacity-60 blur-[2px]');
              // The overview holds buttons of its own (its frames), so it is not one itself: off
              // centre, a press on it centres it; centred, its frames do the work.
              if (c.overview) {
                return (
                  <div
                    key={c.key}
                    data-hero-anchor="window"
                    onClick={() => {
                      if (!playing) show(i);
                    }}
                    style={{ width: cardWidth }}
                    className={`cursor-pointer ${cardClassName}`}
                  >
                    <HeroOverview
                      scenes={OVERVIEW_SCENES}
                      onOpen={(key) => show(CARDS.findIndex((k) => k.key === key))}
                    />
                  </div>
                );
              }
              // A mode window holds a link (Build yours), so it is not a button itself: a press on it
              // centres it.
              return (
                <div
                  key={c.key}
                  onClick={() => {
                    if (!playing) show(i);
                  }}
                  style={{ width: cardWidth }}
                  className={`${playing ? '' : 'cursor-pointer '}${cardClassName}`}
                >
                  {frame}
                </div>
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

      {/* Dot navigation: a label for the centred window, and one dot per
          window so a visitor moves between them at their own pace (the
          auto-advance timer resets on each choice). */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
          {current.label}
        </p>
        {/* The stage is decorative, so its Build yours buttons are out of reach of a keyboard or a
            screen reader; this is the same link for the centred window, shown when focused. */}
        {current.build ? (
          <a
            href={ctaHref(current.build, 'Home.HeroBuild')}
            className="sr-only rounded-md text-sm font-semibold text-brand-700 focus:not-sr-only focus:px-2 focus:py-1 dark:text-brand-300"
          >
            Build your own {current.short?.toLowerCase()}
          </a>
        ) : null}
        {/* Each dot sits in a 24px-tall hit area; the overview's is always a small grid, a little
            larger (in brand while it is showing), so the way back to it is easy to find and hit. */}
        <div className="flex items-center" role="group" aria-label="Hero examples">
          {CARDS.map((c, i) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              aria-current={i === active}
              onClick={() => show(i)}
              className="group/dot flex h-6 items-center justify-center rounded-full px-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
            >
              {c.overview ? (
                <EverythingIcon
                  size={14}
                  aria-hidden
                  className={`mx-0.5 transition-colors ${
                    i === active
                      ? 'text-brand-500'
                      : 'text-slate-400 group-hover/dot:text-brand-500 dark:text-slate-500'
                  }`}
                />
              ) : (
                <span
                  aria-hidden
                  className={
                    'block h-2 rounded-full transition-all ' +
                    (i === active
                      ? 'w-7 bg-brand-500'
                      : 'w-2 bg-slate-300 group-hover/dot:bg-slate-400 dark:bg-slate-600')
                  }
                />
              )}
            </button>
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

// A mode window's call to action: once the scene has played out, it lands in the middle of the
// canvas (hero-build, hero-mode-animations.css) and opens the template step narrowed to this
// window's kind. The link carries the entrance; its face carries the look and the hover (a lift,
// a brighter gradient, the arrow nudging on), so neither transform fights the other. A soft halo
// breathes behind it. Only on the centred window; a peeking one shows none.
function BuildYours({ href, live }: { href: string; live: boolean }) {
  if (!live) return null;
  return (
    <a
      href={ctaHref(href, 'Home.HeroBuild')}
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
      className="hero-build group/build absolute left-1/2 top-1/2 z-30 rounded-full outline-none"
    >
      <span
        aria-hidden
        className="hero-build-halo absolute -inset-2 rounded-full bg-brand-400/30 blur-md"
      />
      <span className="relative inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 py-3 pl-4 pr-5 text-base font-semibold text-white shadow-[0_12px_32px_-10px] shadow-brand-600/70 ring-1 ring-inset ring-white/25 transition duration-200 ease-out group-hover/build:from-brand-400 group-hover/build:to-indigo-400 dark:from-brand-600 dark:to-indigo-600 dark:group-hover/build:from-brand-500 dark:group-hover/build:to-indigo-500 group-hover/build:shadow-[0_18px_40px_-10px] motion-safe:group-hover/build:-translate-y-0.5 motion-safe:group-hover/build:scale-[1.03] group-active/build:translate-y-0 group-active/build:scale-100">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
          <SparkleIcon size={15} aria-hidden />
        </span>
        Build yours
        <ChevronRightIcon
          size={16}
          aria-hidden
          className="transition-transform duration-200 motion-safe:group-hover/build:translate-x-1"
        />
      </span>
    </a>
  );
}
