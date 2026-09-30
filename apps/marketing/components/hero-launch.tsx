'use client';

// The hero stage's launch window (docs/specs/019-marketing/marketing-site.md): a brand-new, empty
// document as /new?blank=1 opens one, drawn in the shared editor-window mock. While centred, a
// click grows its canvas to fill the screen and lands on /new?blank=1&quickstart=1, a blank
// document with Quick Start already open (docs/specs/007-editor/new-document-route.md).
//
// The growth is a fixed layer portalled to <body> (the stage's track is transformed, which would
// trap a fixed child), clipped from the canvas's own rect to the whole viewport while its paper
// eases to the opening screen's canvas colour, so it lands on the very screen /new paints next.
// It runs for the page-transition token (docs/specs/004-interface-design/motion.md), and the
// navigation follows its end, so nobody waits on it for longer than a dialog opens.

import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ctaHref } from '@livediagram/api-schema';
import { Glyph, PREFERS_REDUCED_MOTION, useMediaQuery } from '@livediagram/ui';
import { UNTITLED_DOCUMENT_NAME } from '@livediagram/templates';

export const LAUNCH_HREF = ctaHref('/new?blank=1&quickstart=1', 'Home.HeroCanvas');

// The window's mock chrome: a fresh document is private, has one tab, and only you on it.
export const LAUNCH_TITLE = UNTITLED_DOCUMENT_NAME;
export const LAUNCH_TAB = 'Tab 1';

// Marks the canvas surface inside an editor window, the rect the growth starts from.
export const HERO_CANVAS_ATTR = 'data-hero-canvas';

type GrowFrom = { top: number; right: number; bottom: number; left: number };

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
    setFrom({
      top: r.top,
      left: r.left,
      right: window.innerWidth - r.right,
      bottom: window.innerHeight - r.bottom,
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
                // Keep the dots where the window drew them, so the canvas grows rather than jumps.
                backgroundPosition: `${from.left}px ${from.top}px`,
              } as CSSProperties
            }
            onAnimationEnd={() => window.location.assign(LAUNCH_HREF)}
          />,
          document.body,
        );

  return { launch, layer };
}

// What the empty canvas holds: the invitation in the middle, and the editor's empty-canvas
// banner (EmptyCanvasBanner in apps/live) at its foot, Quick Start and all.
export function LaunchCanvasOverlay({ playing }: { playing: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 right-0 sm:right-44">
      <div className="absolute inset-0 flex items-center justify-center pb-10">
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
      </div>
      <div className="absolute inset-x-3 bottom-12 flex justify-center sm:bottom-11">
        <div className="flex w-full max-w-sm items-center gap-2.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-left shadow-md dark:border-slate-700 dark:bg-slate-900/95">
          <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-500 sm:flex dark:bg-brand-500/15 dark:text-brand-400">
            <Glyph size={14} units={24}>
              <rect x="3" y="6" width="10" height="10" rx="1.5" />
              <circle cx="16" cy="14" r="5" />
            </Glyph>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-medium text-slate-800 dark:text-slate-100">
              {LAUNCH_TAB} is empty
            </span>
            <span className="block truncate text-[9px] text-slate-500 dark:text-slate-400">
              Add an element from the Palette, or start from a template.
            </span>
          </span>
          <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Quick Start
          </span>
        </div>
      </div>
    </div>
  );
}
