'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PREFERS_REDUCED_MOTION, useMediaQuery } from '@livediagram/ui';

// The headline's first word cycles through what livediagram is for
// (docs/specs/019-marketing/marketing-site.md): Diagram, Document, Whiteboard, Brainstorm ...
// together, live. The headline stays on one line, and a change never moves anything in layout
// (docs/specs/004-interface-design/layout-stability.md): every word sits in the same grid cell, so
// the slot is as wide as the widest, and each word is right-aligned in it, snug against
// "together". A shorter word would leave the line off-centre by half the difference, so the whole
// line glides by that much with a transform (no layout shift) to stay centred. The glide is
// published as data-shift on the line, so the headline's connector (HeroConnectors) follows it.
// Only the current word and the one leaving render visibly: a quiet ticker, the leaving one
// sliding up out of the clipped slot as the next slides up into place (hero-word-* in
// app/hero-animations.css). The static HTML reads "Diagram",
// the first paint has no motion, and reduced motion holds "Diagram". A dotted underline marks the
// word as more than it shows: hovering it (or tapping it, on touch) opens a card listing every word
// (the current one in brand) and holds the cycle while it is up. Decorative: the h1 carries the stable
// text for screen readers.

const HERO_WORDS = ['Diagram', 'Document', 'Whiteboard', 'Brainstorm'] as const;

// How long each word holds before the next.
const WORD_MS = 1500;

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
  // The card listing every word: opened by hovering the word with a mouse, or tapping it, and
  // closed by leaving it or tapping anywhere else. The cycle holds while it is up.
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  // Centred under the word, the card can run off a phone's edge (the word sits near it): nudge it
  // back inside an 8px margin. Straight onto the element, before paint, with no extra render.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!open || !card) return;
    card.style.marginLeft = '';
    const r = card.getBoundingClientRect();
    const margin = 8;
    const nudge =
      r.left < margin
        ? margin - r.left
        : r.right > window.innerWidth - margin
          ? window.innerWidth - margin - r.right
          : 0;
    if (nudge) card.style.marginLeft = `${nudge}px`;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && !triggerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (reduceMotion || open) return;
    const id = window.setInterval(
      () => setWords((w) => ({ index: (w.index + 1) % HERO_WORDS.length, leaving: w.index })),
      WORD_MS,
    );
    return () => window.clearInterval(id);
  }, [reduceMotion, open]);

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
  // The showing word's centre in the line (it is right-aligned in a slot as wide as the widest).
  const wordCentre = widths ? Math.max(...widths) - (widths[shown] ?? 0) / 2 : '50%';

  useEffect(() => {
    window.dispatchEvent(new Event(HERO_TITLE_SHIFT_EVENT));
  }, [shift]);

  return (
    <span
      data-hero-anchor="title"
      data-shift={shift}
      className="hero-title-line relative inline-block whitespace-nowrap"
      style={{ transform }}
    >
      <span
        ref={triggerRef}
        className="group cursor-default"
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setOpen(false);
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== 'mouse') setOpen((o) => !o);
        }}
      >
        <span ref={slotRef} className="hero-word-slot inline-grid justify-items-end">
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
                className={`[grid-area:1/1] underline decoration-slate-300 decoration-dotted decoration-[0.05em] underline-offset-[0.14em] transition group-hover:decoration-brand-400 dark:decoration-slate-600 ${state}`}
              >
                {word}
              </span>
            );
          })}
        </span>
      </span>
      {open ? (
        // Every word, centred under the one showing: the hover card's look, opened by a hover or
        // a tap (a hint cannot open on a tap), outside the slot so its clip cannot cut it.
        <span
          ref={cardRef}
          className="absolute top-full z-10 mt-2 w-max -translate-x-1/2 animate-fade-in whitespace-normal rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal tracking-normal shadow-lg shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-950/40"
          style={{ left: wordCentre }}
        >
          <span className="flex items-center gap-2 font-semibold">
            {HERO_WORDS.map((word, i) => (
              <span
                key={word}
                className={
                  i === shown
                    ? 'text-brand-600 dark:text-brand-300'
                    : 'text-slate-500 dark:text-slate-400'
                }
              >
                {word}
              </span>
            ))}
          </span>
          <span className="mt-0.5 block leading-relaxed text-slate-600 dark:text-slate-300">
            Whatever you&rsquo;re making, make it together.
          </span>
        </span>
      ) : null}
      {children}
    </span>
  );
}
