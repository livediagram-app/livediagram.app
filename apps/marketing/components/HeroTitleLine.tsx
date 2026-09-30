'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PREFERS_REDUCED_MOTION, useMediaQuery } from '@livediagram/ui';

// The headline's first word cycles through what livediagram is for
// (docs/specs/019-marketing/marketing-site.md): Diagram, Document, Whiteboard ... together,
// live. The headline stays on one line, and a change never moves anything in layout
// (docs/specs/004-interface-design/layout-stability.md): every word sits in the same grid cell, so
// the slot is as wide as the widest, and each word is right-aligned in it, snug against
// "together". A shorter word would leave the line off-centre by half the difference, so the whole
// line glides by that much with a transform (no layout shift) to stay centred. The glide is
// published as data-shift on the line, so the headline's connector (HeroConnectors) follows it.
// Only the current word and the one leaving render visibly: a quiet ticker, the leaving one
// sliding up out of the clipped slot as the next slides up into place (hero-word-* in
// app/hero-animations.css). The static HTML reads "Diagram",
// the first paint has no motion, and reduced motion holds "Diagram". Decorative: the h1 carries
// the stable text for screen readers.

const HERO_WORDS = ['Diagram', 'Document', 'Whiteboard'] as const;

// How long each word holds before the next.
const WORD_MS = 7000;

// Half the gap between "Whiteboard" and "Diagram", in em: the first word's glide before anything
// is measured (0.694em at 72px, 0.710em at 24px).
const DIAGRAM_SHIFT_EM = 0.7;

// Fired on window when the line's glide target changes, so the connector re-measures.
export const HERO_TITLE_SHIFT_EVENT = 'livediagram:hero-title-shift';

export function HeroTitleLine({ children }: { children: ReactNode }) {
  // The word showing, and the one that just left (animating out); null on first paint, so nothing
  // moves on load.
  const [{ index, leaving }, setWords] = useState<{ index: number; leaving: number | null }>({
    index: 0,
    leaving: null,
  });
  const reduceMotion = useMediaQuery(PREFERS_REDUCED_MOTION);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const slotRef = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[] | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(
      () => setWords((w) => ({ index: (w.index + 1) % HERO_WORDS.length, leaving: w.index })),
      WORD_MS,
    );
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  // Each word's rendered width, re-read when the headline resizes (it scales with the viewport).
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const observer = new ResizeObserver(() =>
      setWidths(wordRefs.current.map((el) => el?.getBoundingClientRect().width ?? 0)),
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  const shown = reduceMotion ? 0 : index;
  const shift = widths ? -Math.round((Math.max(...widths) - (widths[shown] ?? 0)) / 2) : 0;
  // Before the words are measured (the static HTML, and the first client render, which must match
  // it), "Diagram" is centred by its measured share of the slot: 0.7em in the house sans.
  const transform = widths ? `translateX(${shift}px)` : `translateX(-${DIAGRAM_SHIFT_EM}em)`;

  useEffect(() => {
    window.dispatchEvent(new Event(HERO_TITLE_SHIFT_EVENT));
  }, [shift]);

  return (
    <span
      data-hero-anchor="title"
      data-shift={shift}
      className="hero-title-line inline-block whitespace-nowrap"
      style={{ transform }}
    >
      <span ref={slotRef} aria-hidden className="hero-word-slot inline-grid justify-items-end">
        {HERO_WORDS.map((word, i) => {
          const state =
            i === shown
              ? leaving === null
                ? ''
                : 'hero-word-in'
              : i === leaving
                ? 'hero-word-out'
                : 'invisible';
          return (
            <span
              // Remount on each entrance so its animation replays.
              key={i === shown ? `${word}-in-${index}` : word}
              ref={(el) => {
                wordRefs.current[i] = el;
              }}
              className={`[grid-area:1/1] ${state}`}
            >
              {word}
            </span>
          );
        })}
      </span>
      {children}
    </span>
  );
}
