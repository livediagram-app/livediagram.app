'use client';

// Animated hero: six editor windows on a sliding stage.
//   1. Your canvas — the launch window (hero-launch.tsx): a fresh, empty,
//      private document. While centred, a click grows it to fill the screen
//      and lands on a new blank document with Quick Start open.
//   2. Flowchart — shared, a teammate cursor, and the theme beat: the Tab
//      Look & Feel dialog opens, a theme card is picked, and the diagram
//      recolours (the only window that recolours; its canvas tints to match).
//   3. Slide deck — the same flowchart presented (docs/specs/012-collaboration/presentation-mode.md): full screen, so
//      no header, tab bar or panels, only the canvas and the presenting HUD;
//      four slides travel across it a piece at a time and end on the whole
//      picture.
//   4. Mind map — shared, a Highlighter swipe across one node, then a laser
//      pointer that rings one node then another.
//   5. Release timeline — private (amber badge, just you, no collaborators),
//      with the Layers panel docked beside it.
//   6. Architecture — shared; a comment thread lands on one service and an
//      assigned action on another, ticked off by the end.
// The chrome mirrors today's editor: the Editor menu and Share button in the
// header, the tabbed palette with its search box and labelled tiles, the zoom
// cluster, and the bottom tab bar's toolbelt. Below the stage, a label names
// the centred window and a row of dots moves between them.
// The centred window plays its pure-CSS build (globals.css, hero-*); the
// peeking windows render settled (.hero-static), blurred + faded, with the
// stage edges masked so they fade out rather than hard-clip. The stage
// auto-advances every 16s (the launch window holds for 32s) and centres a window when clicked (timer resets on
// interaction). Every window ends the same way: over its last second it
// fades to a light grey, the stage moves on, and the next window lifts from
// that grey (hero-fade), so no build is ever seen snapping back to its first
// frame. Windows are wider on mobile (less peek, more legible).
//
// It's the page's third 'use client' boundary; with JS off it renders the
// first window centred, and reduced-motion settles every build, the canvas
// tint, and hides the laser.

import { useEffect, useRef, useState } from 'react';
import { PREFERS_REDUCED_MOTION, useMediaQuery } from '@livediagram/ui';
import {
  ArchitectureDiagram,
  FlowchartDiagram,
  MindMapDiagram,
  SlideDeckDiagram,
  TimelineDiagram,
} from './hero-diagrams';
import { snapStage } from '@/lib/hero-stage';
import { EditorWindow, type TabDef } from './hero-editor-window';
import { useStageBox } from './useStageBox';
import {
  LAUNCH_DWELL_MS,
  LAUNCH_HREF,
  LAUNCH_TAB,
  LAUNCH_TITLE,
  LaunchCanvasOverlay,
  useLaunchGrow,
} from './hero-launch';

// Geometry: each window is `card`% of the stage with a GAP% gutter, so the
// centred window sits at translateX = (100 - card) / 2 - i * (card + GAP).
// `card` is wider on mobile so the windows stay legible there.
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
  // The canvas tool the palette's picker names. A pair is two beats: the
  // mind map reads Highlighter while the swipe happens, then Laser.
  tool: string | [string, string];
  tabs: TabDef[];
  showCursor: boolean;
  shared: boolean;
  theming: boolean;
  // Presenting (docs/specs/012-collaboration/presentation-mode.md): the panels give way to the presenting HUD, and
  // the canvas shows the deck's slides instead of the whole diagram.
  presenting?: boolean;
  // Dock the Layers panel (docs/specs/006-document/layers.md) on this window's canvas, and minimise
  // the palette to its header bar (as the editor does), so the wide
  // timeline has the canvas to itself.
  layers?: boolean;
  // The launch window: a link that grows into a new document (hero-launch.tsx).
  launch?: boolean;
  // Draw the editor in its Toolbar panel layout (docs/specs/007-editor/toolbar-layout.md).
  toolbar?: boolean;
}[] = [
  {
    key: 'launch',
    title: LAUNCH_TITLE,
    label: 'A fresh canvas of your own: click it to start drawing',
    tool: 'Select',
    tabs: [{ name: LAUNCH_TAB, color: '#0ea5e9', active: true }],
    showCursor: false,
    shared: false,
    theming: false,
    launch: true,
    toolbar: true,
  },
  {
    key: 'flowchart',
    title: 'Quarterly planning',
    label: 'A flowchart, shared live, restyled in a single click',
    tool: 'Select',
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
    key: 'slides',
    title: 'Quarterly planning',
    label: 'The same flowchart presented as slides, one piece at a time',
    tool: 'Select',
    tabs: [
      { name: 'Overview', color: '#0ea5e9', active: true },
      { name: 'Roadmap', color: '#ec4899' },
      { name: 'Launch', color: '#8b5cf6' },
    ],
    showCursor: false,
    shared: true,
    theming: false,
    presenting: true,
  },
  {
    key: 'mindmap',
    title: 'Team mind map',
    label: 'A mind map, highlighted and laser-pointed for the room',
    tool: ['Highlighter', 'Laser'],
    tabs: [
      { name: 'Ideas', color: '#0ea5e9', active: true },
      { name: 'Themes', color: '#ec4899' },
      { name: 'Actions', color: '#8b5cf6' },
    ],
    showCursor: false,
    shared: true,
    theming: false,
  },
  {
    key: 'timeline',
    title: 'Release timeline',
    label: 'A private timeline, organised into layers',
    tool: 'Select',
    tabs: [
      { name: 'Roadmap', color: '#0ea5e9', active: true },
      { name: 'Milestones', color: '#ec4899' },
      { name: 'Releases', color: '#8b5cf6' },
    ],
    showCursor: false,
    shared: false,
    theming: false,
    layers: true,
  },
  {
    key: 'comments',
    title: 'Platform architecture',
    label: 'An architecture diagram, discussed in comments and turned into actions',
    tool: 'Select',
    tabs: [
      { name: 'Services', color: '#0ea5e9', active: true },
      { name: 'Data', color: '#ec4899' },
      { name: 'Infra', color: '#8b5cf6' },
    ],
    showCursor: false,
    shared: true,
    theming: false,
  },
];

// Window width as a % of the stage: narrower peek (wider window) on phones.
// Phrased as the phone query so the static render (where a media query reads
// false) keeps the wide layout, as before.
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

  const tx = (100 - card) / 2 - active * (card + GAP);
  // Whole-pixel geometry once the stage is measured (lib/hero-stage.ts), so the centred window's
  // text renders sharp; the percentages above hold until then (and with JS off).
  const stageRef = useRef<HTMLDivElement>(null);
  const box = useStageBox(stageRef);
  const snapped = box ? snapStage(box, card, GAP, active) : null;
  const cardWidth = snapped ? `${snapped.cardPx}px` : `${card}%`;

  const { launch, layer } = useLaunchGrow();

  const current = CARDS[active] ?? CARDS[0]!;
  return (
    <div className="mx-auto mt-16 w-full max-w-6xl">
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
              : { gap: `${GAP}%`, transform: `translateX(${tx}%)` }
          }
        >
          {CARDS.map((c, i) => {
            const playing = i === active;
            const liveDoc = c.launch ? null : c.key === 'mindmap' ? (
              <MindMapDiagram playing={playing} />
            ) : c.key === 'slides' ? (
              <SlideDeckDiagram />
            ) : c.key === 'comments' ? (
              <ArchitectureDiagram />
            ) : c.key === 'timeline' ? (
              <TimelineDiagram />
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
                layers={c.layers ?? false}
                presenting={c.presenting ?? false}
                tool={c.tool}
                playing={playing}
                document={liveDoc}
                overlay={
                  c.launch ? (
                    <LaunchCanvasOverlay playing={playing} afterConnector={!moved} />
                  ) : undefined
                }
                toolbar={c.toolbar ?? false}
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
