'use client';

import { PREFERS_REDUCED_MOTION, useMediaQuery } from '@livedocuments/ui';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// The hero headline's verb, written live (docs/specs/019-marketing/marketing-site.md "Hero"): on an amber
// highlight, a caret after it carrying a co-author's name flag, deleted and typed again as the next verb every
// few seconds. The static HTML holds the first verb, so the first frame is complete. The slot is as wide as the
// longest verb (every verb laid in one grid cell, hidden), so the line breaks never change and nothing
// reflows; the words sharing the verb's line then close up round the word on show by transforms alone (each
// word its own inline-block, since an inline box can't be transformed), so a short verb leaves no gap and the
// line stays centred without a layout shift. Screen readers get the first verb alone, once: the typed one is
// aria-hidden. One timer, and only this component re-renders; it holds off screen, in a hidden tab and under
// reduced motion.

export const HERO_VERBS = ['writing', 'presenting', 'publishing'] as const;
export const HERO_COAUTHOR = 'Sam';
// How long a verb rests, and how long each letter takes to go and to come.
export const HERO_VERB_HOLD_MS = 2600;
const DELETE_MS = 55;
const TYPE_MS = 95;

export type HeroFlagPlace = 'above' | 'below' | 'none';

// Where the co-author's name flag can ride without covering another word of the headline: below the caret while
// the verb is on the last line (nothing of the headline under it), above it while the verb is on the first, and
// nowhere on a line between. Above was the only place once, and on a phone it covered "are". Line tops are
// offsetTop values.
export function heroFlagPlace(verbTop: number, firstTop: number, lastTop: number): HeroFlagPlace {
  if (verbTop >= lastTop) return 'below';
  if (verbTop <= firstTop) return 'above';
  return 'none';
}

export function HeroVerb({ before, after }: { before: string; after: string }) {
  const [shown, setShown] = useState<string>(HERO_VERBS[0]);
  const [running, setRunning] = useState(true);
  const reduceMotion = useMediaQuery(PREFERS_REDUCED_MOTION);
  const rootRef = useRef<HTMLSpanElement>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const wordsRef = useRef<HTMLSpanElement>(null);
  const flagRef = useRef<HTMLSpanElement>(null);
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

  const text = (reduceMotion ? HERO_VERBS[0] : shown) || '\u200b';

  // Close the gap the word on show leaves in its slot: the slot and the words before it on its line move
  // right by half of it, the words after it left by half. Measured after each letter and on any resize (a
  // late font, a new width); two reads and a few style writes, no re-render.
  useLayoutEffect(() => {
    const slot = rootRef.current;
    const typed = typedRef.current;
    const words = wordsRef.current;
    if (!slot || !typed || !words) return;
    const close = () => {
      const half = (slot.offsetWidth - typed.offsetWidth) / 2;
      const line = slot.offsetTop;
      const all = words.children as HTMLCollectionOf<HTMLElement>;
      let past = false;
      for (const el of all) {
        if (el === slot) past = true;
        const shift = el.offsetTop !== line ? 0 : past && el !== slot ? -half : half;
        el.style.transform = shift ? `translateX(${shift}px)` : '';
      }
      const flag = flagRef.current;
      if (flag && all.length > 0)
        flag.dataset.place = heroFlagPlace(line, all[0]!.offsetTop, all[all.length - 1]!.offsetTop);
    };
    close();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(close);
    ro.observe(words);
    return () => ro.disconnect();
  }, [text]);

  const word = (w: string) => (
    <span
      key={w}
      className="inline-block transition-transform duration-100 ease-out motion-reduce:transition-none"
    >
      {w}
    </span>
  );
  const spaced = (ws: string[]) => ws.flatMap((w, i) => (i ? [' ', word(w)] : [word(w)]));

  return (
    <span ref={wordsRef}>
      {spaced(before.split(' '))}{' '}
      <span
        ref={rootRef}
        className="inline-grid align-baseline transition-transform duration-100 ease-out motion-reduce:transition-none"
      >
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
          ref={typedRef}
          data-hero-verb=""
          className="col-start-1 row-start-1 justify-self-start whitespace-nowrap"
        >
          <span className="rounded-[0.12em] bg-amber-200/70 px-[0.12em] dark:bg-amber-500/30">
            {text}
          </span>
          {/* The caret blinks; its name flag, beside it rather than in it, stays lit. */}
          <span className="relative ml-[0.04em] inline-block h-[0.85em] w-[0.06em] translate-y-[0.08em]">
            <span className="hero-caret absolute inset-0 rounded-full bg-amber-700 dark:bg-amber-400" />
            {/* Below the caret until measured (the verb sits on the last line at every width it has been
                seen at); heroFlagPlace moves it above, or hides it, when that would cover a word. */}
            <span
              ref={flagRef}
              data-hero-flag=""
              data-place="below"
              className="absolute left-0 whitespace-nowrap rounded-md bg-amber-700 px-2 py-0.5 font-sans text-xs font-bold leading-4 tracking-normal text-white data-[place=above]:bottom-full data-[place=above]:mb-1 data-[place=above]:rounded-bl-none data-[place=below]:top-full data-[place=below]:mt-1 data-[place=below]:rounded-tl-none data-[place=none]:hidden sm:text-sm dark:bg-amber-400 dark:text-amber-950"
            >
              {HERO_COAUTHOR}
            </span>
          </span>
        </span>
      </span>{' '}
      {spaced(after.split(' '))}
    </span>
  );
}
