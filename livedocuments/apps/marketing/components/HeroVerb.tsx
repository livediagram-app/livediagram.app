'use client';

import { PREFERS_REDUCED_MOTION, useMediaQuery } from '@livedocuments/ui';
import { useEffect, useRef, useState } from 'react';

// The hero headline's verb, written live (docs/specs/019-marketing/marketing-site.md "Hero"): on an amber
// highlight, a caret after it carrying a co-author's name flag, deleted and typed again as the next verb every
// few seconds. The static HTML holds the first verb, so the first frame is complete. The slot is as wide as the
// longest verb (every verb laid in one grid cell, hidden), so the line breaks and "today?" never move. Screen
// readers get the first verb alone, once: the typed one is aria-hidden. One timer, and only this component
// re-renders; it holds off screen, in a hidden tab and under reduced motion.

export const HERO_VERBS = ['writing', 'presenting', 'publishing'] as const;
export const HERO_COAUTHOR = 'Sam';
// How long a verb rests, and how long each letter takes to go and to come.
export const HERO_VERB_HOLD_MS = 2600;
const DELETE_MS = 55;
const TYPE_MS = 95;

export function HeroVerb() {
  const [shown, setShown] = useState<string>(HERO_VERBS[0]);
  const [running, setRunning] = useState(true);
  const reduceMotion = useMediaQuery(PREFERS_REDUCED_MOTION);
  const rootRef = useRef<HTMLSpanElement>(null);
  // Where the typing has got to, kept beside the state so a pause resumes mid-word.
  const step = useRef<{ verb: number; text: string; deleting: boolean }>({
    verb: 0,
    text: HERO_VERBS[0],
    deleting: false,
  });

  // Off screen, or in a hidden tab, nobody is reading: hold.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let visible = true;
    let tabShown = document.visibilityState !== 'hidden';
    const sync = () => setRunning(visible && tabShown);
    const io = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? true;
      sync();
    });
    io.observe(el);
    const onVisibility = () => {
      tabShown = document.visibilityState !== 'hidden';
      sync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || !running) return;
    let timer: number;
    const tick = () => {
      // A tab hidden since the last letter: wait for it to show again, as the fan does.
      if (document.visibilityState === 'hidden') {
        timer = window.setTimeout(tick, HERO_VERB_HOLD_MS);
        return;
      }
      const s = step.current;
      const target = HERO_VERBS[s.verb]!;
      let wait: number;
      if (s.deleting) {
        s.text = s.text.slice(0, -1);
        if (s.text === '') {
          s.deleting = false;
          s.verb = (s.verb + 1) % HERO_VERBS.length;
        }
        wait = DELETE_MS;
      } else if (s.text !== target) {
        s.text = target.slice(0, s.text.length + 1);
        wait = s.text === target ? HERO_VERB_HOLD_MS : TYPE_MS;
      } else {
        s.deleting = true;
        s.text = s.text.slice(0, -1);
        wait = DELETE_MS;
      }
      setShown(s.text);
      timer = window.setTimeout(tick, wait);
    };
    // A whole verb on show rests first; a pause mid-word picks up at the next letter.
    const s = step.current;
    timer = window.setTimeout(
      tick,
      !s.deleting && s.text === HERO_VERBS[s.verb] ? HERO_VERB_HOLD_MS : TYPE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [running, reduceMotion]);

  return (
    <span ref={rootRef} className="inline-grid align-baseline">
      <span className="sr-only">{HERO_VERBS[0]}</span>
      {HERO_VERBS.map((v) => (
        <span
          key={v}
          aria-hidden
          className="invisible col-start-1 row-start-1 pl-[0.12em] pr-[0.3em]"
        >
          {v}
        </span>
      ))}
      <span
        aria-hidden
        data-hero-verb=""
        className="col-start-1 row-start-1 justify-self-start whitespace-nowrap"
      >
        <span className="rounded-[0.12em] bg-amber-200/70 px-[0.12em] dark:bg-amber-500/30">
          {(reduceMotion ? HERO_VERBS[0] : shown) || '\u200b'}
        </span>
        {/* The caret blinks; its name flag, beside it rather than in it, stays lit. */}
        <span className="relative ml-[0.04em] inline-block h-[0.85em] w-[0.06em] translate-y-[0.08em]">
          <span className="hero-caret absolute inset-0 rounded-full bg-amber-700 dark:bg-amber-400" />
          <span className="absolute bottom-full left-0 mb-1 whitespace-nowrap rounded-md rounded-bl-none bg-amber-700 px-2 py-0.5 font-sans text-xs font-bold leading-4 tracking-normal text-white sm:text-sm dark:bg-amber-400 dark:text-amber-950">
            {HERO_COAUTHOR}
          </span>
        </span>
      </span>
    </span>
  );
}
