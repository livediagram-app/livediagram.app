'use client';

// The hero stage's launch window (docs/specs/019-marketing/marketing-site.md): a brand-new, empty
// document as /new?blank=1 opens one, drawn in the shared editor-window mock. While centred, a
// click grows its canvas to fill the screen and lands on /new?blank=1&welcome=1, a blank
// document on that same canvas, with the tour's welcome offer (docs/specs/007-editor/new-document-route.md).
//
// The growth is a fixed layer portalled to <body> (the stage's track is transformed, which would
// trap a fixed child), clipped from the canvas's own rect to the whole viewport. It is the
// editor's blank canvas, and /new?blank=1&welcome=1 holds that same canvas until the editor
// has loaded over it (apps/live BlankCanvasScreen), so the whole way in is one surface.
// It runs for 600ms, eased in and out, paced as the illustration it grows out of (a content
// illustration, docs/specs/004-interface-design/motion.md), and the navigation follows its end.
// The window prefetches /new when the pointer first rests on it (prefetchLaunch), so the page is
// usually in the cache by then.

import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ctaHref } from '@livediagram/api-schema';
import { Glyph, PREFERS_REDUCED_MOTION, Prims, useMediaQuery } from '@livediagram/ui';
import { UNTITLED_DOCUMENT_NAME } from '@livediagram/templates';
import { lucideGift, lucideGitFork, lucideUsers, lucideUserX } from '@livediagram/icons/lucide';
import type { IconPrim } from '@livediagram/icons';
import { PROOF_POINTS, type ProofPoint } from '@/lib/proof-points';

export const LAUNCH_HREF = ctaHref('/new?blank=1&welcome=1', 'Home.HeroCanvas');

// The window's mock chrome: a fresh document is private, has one tab, and only you on it.
export const LAUNCH_TITLE = UNTITLED_DOCUMENT_NAME;
export const LAUNCH_TAB = 'Tab 1';

// How long the stage holds on the launch window before moving on: nearly four build cycles, since
// it is the window the stage opens on and the one a visitor can step into.
export const LAUNCH_DWELL_MS = 60000;

// Marks the canvas surface inside an editor window, the rect the growth starts from.
export const HERO_CANVAS_ATTR = 'data-hero-canvas';

// Warm the browser's cache with /new the first time the launch window is pointed at, so the
// navigation at the end of the growth has less to fetch. Once per page; a no-op without support.
let prefetched = false;
export function prefetchLaunch() {
  if (prefetched) return;
  prefetched = true;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = LAUNCH_HREF;
  document.head.appendChild(link);
}

type GrowFrom = { top: number; right: number; bottom: number; left: number; stop: number };

// A plain click grows the window; a modified or non-primary click is the browser's (new tab,
// new window, download) and follows the link untouched.
function isPlainClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function useLaunchGrow() {
  const [from, setFrom] = useState<GrowFrom | null>(null);
  const reduceMotion = useMediaQuery(PREFERS_REDUCED_MOTION);

  // Back from the editor can restore this page from the back/forward cache exactly as it was
  // left, grown layer and all. Clear it so the hero is there again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setFrom(null);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  // Returns whether it took the click (so the caller prevents the link's own navigation).
  const launch = (e: MouseEvent<HTMLElement>): boolean => {
    if (!isPlainClick(e)) return false;
    if (reduceMotion) {
      window.location.assign(LAUNCH_HREF);
      return true;
    }
    const canvas = e.currentTarget.querySelector(`[${HERO_CANVAS_ATTR}]`) ?? e.currentTarget;
    const r = canvas.getBoundingClientRect();
    // The canvas grows to fill the page BELOW the sticky site header, never over it: the header
    // stays put, so the new canvas reads as opening in the page rather than replacing the site.
    const header = document.querySelector('header');
    const stop = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    setFrom({
      top: r.top,
      left: r.left,
      right: window.innerWidth - r.right,
      bottom: window.innerHeight - r.bottom,
      stop,
    });
    return true;
  };

  const layer =
    from === null
      ? null
      : createPortal(
          <div
            aria-hidden
            className="hero-grow"
            style={
              {
                '--grow-t': `${from.top}px`,
                '--grow-r': `${from.right}px`,
                '--grow-b': `${from.bottom}px`,
                '--grow-l': `${from.left}px`,
                '--grow-stop': `${from.stop}px`,
                // Start the dots where the window drew them, so the canvas grows rather than jumps.
                '--grow-x': `${from.left}px`,
                '--grow-y': `${from.top}px`,
              } as CSSProperties
            }
            onAnimationEnd={() => window.location.assign(LAUNCH_HREF)}
          />,
          document.body,
        );

  return { launch, layer };
}

// Each proof point's node is painted, as a user paints a shape (the editor keeps a user's paint on
// any theme): its own hue and an icon for what it promises.
const PROOF_NODE: Record<ProofPoint, { hue: string; icon: readonly IconPrim[] }> = {
  'Free for everyone': { hue: '#10b981', icon: lucideGift },
  'No sign-up': { hue: '#f59e0b', icon: lucideUserX },
  'Real-time collaboration': { hue: '#8b5cf6', icon: lucideUsers },
  'Open source (MIT)': { hue: '#0ea5e9', icon: lucideGitFork },
};

// What the empty canvas holds: the invitation, centred, with the proof points under it as a
// small flow of nodes. Nothing else, so the window reads as a blank page waiting for its
// first shape.
export function LaunchCanvasOverlay({
  playing,
  afterConnector,
}: {
  playing: boolean;
  // The page's first play: the flow waits for the headline's connector to land (HeroConnectors).
  afterConnector: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-16 px-6">
      <span
        className={
          'inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition group-hover:bg-brand-500 dark:bg-brand-500 dark:group-hover:bg-brand-400 ' +
          (playing ? 'hero-launch-invite' : '')
        }
      >
        <Glyph size={16} units={16} className="h-4 w-4">
          <path d="M3 2l9 5-4 1 2.5 4.5-1.8 1L6.2 9 3 12z" />
        </Glyph>
        Click to start drawing
      </span>
      {/* The proof points as a little flow on the canvas: each a node painted as a user paints a
          shape, wired to the next. Not on a phone, where the window is too narrow for a row and a
          column crowded the invitation; the hero's screen-reader list still carries them.
          They build in, one after the other, while the window is centred. */}
      <ol
        className={
          'hidden w-full max-w-2xl items-center justify-center sm:flex lg:w-auto lg:max-w-none ' +
          (afterConnector ? 'hero-proof-after-connector' : '')
        }
      >
        {PROOF_POINTS.map((point, i) => (
          <li
            key={point}
            className="flex min-w-0 flex-1 items-center last:flex-none last:basis-[22%] lg:flex-none lg:last:basis-auto"
            style={{ '--i': i, '--hue': PROOF_NODE[point].hue } as CSSProperties}
          >
            <span
              className={
                'flex min-h-11 w-full items-center gap-2 rounded-xl border-[1.5px] border-(--hue) bg-[color-mix(in_srgb,var(--hue)_10%,var(--art-paper))] py-1.5 pl-1.5 pr-2.5 text-left text-[11px] font-semibold leading-tight text-[color-mix(in_srgb,var(--hue)_40%,var(--art-text))] shadow-sm shadow-[color-mix(in_srgb,var(--hue)_25%,transparent)] lg:w-auto lg:whitespace-nowrap ' +
                (playing ? 'hero-proof-node' : '')
              }
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-(--hue) text-white">
                <Glyph size={12} units={24}>
                  <Prims prims={PROOF_NODE[point].icon} />
                </Glyph>
              </span>
              {/* Cap-band centred against the icon tile (optical-alignment.md): a bare text
                  node sat by its line box, visibly high on Linux fonts. */}
              <span className="text-optical-line">{point}</span>
            </span>
            {i < PROOF_POINTS.length - 1 ? (
              <svg
                aria-hidden
                viewBox="0 0 24 10"
                className={
                  'mx-1.5 h-2.5 w-6 shrink-0 text-(--hue) lg:mx-1 lg:w-5 ' +
                  (playing ? 'hero-proof-arrow' : '')
                }
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 5h21M18 1.5 22 5l-4 3.5" />
              </svg>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
