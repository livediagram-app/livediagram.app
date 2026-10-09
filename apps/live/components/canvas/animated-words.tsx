// Splitting a label's words for the Text animation set (docs/specs/028-animation/element-animations.md
// "Text"). A label animates letter by letter, word by word, or as one block, depending on the
// animation and on how long the label is; each unit is a span carrying its index (`--i`), which the
// keyframes in app/motion-text.css read against the label's progress. Nothing here runs per frame:
// the split happens once per label change and CSS does the rest.
//
// The split never changes what is read or copied: the label keeps its full text as its accessible
// name, every unit is aria-hidden, and the stand-in glyphs of Scramble live only in pseudo-element
// content (data attributes), never in the DOM text.

import type { ReactNode } from 'react';
import { fnv1aString, type TextAnimation } from '@livediagram/document';

// Every unit is restyled each frame its label's progress moves, at about 10 µs a unit in the
// editor (measured), so a label is held to a few dozen units: a title or a label types letter by
// letter, a paragraph word by word, a long note as one block.
/** Above this many letters a label animates by word (EA1). */
export const TEXT_ANIM_MAX_LETTERS = 60;
/** Above this many words a label animates as one block (EA1). */
export const TEXT_ANIM_MAX_WORDS = 60;
/** The share of letters that flicker (EA8). */
export const FLICKER_SHARE = 0.12;

export type TextAnimMode = 'letters' | 'words' | 'block';

// The unit each animation is built on.
const LETTER_ANIMS = new Set<TextAnimation>([
  'typewriter',
  'cascade',
  'scramble',
  'wave',
  'shine',
  'flicker',
  'rainbow',
]);
const WORD_ANIMS = new Set<TextAnimation>(['words']);
const REVEALS = new Set<TextAnimation>([
  'typewriter',
  'words',
  'cascade',
  'focus',
  'scramble',
  'highlighter',
  'underline',
]);

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

export function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}

const isSpace = (s: string) => /^\s+$/.test(s);
const wordsOf = (text: string) => text.split(/(\s+)/).filter((s) => s.length > 0);

export type TextAnimPlan = {
  // The animation actually drawn: a letter animation on a long label falls back (see below).
  animation: TextAnimation;
  mode: TextAnimMode;
  // How many units the label splits into, across every run.
  count: number;
  seed: string;
};

/**
 * How a label animates: its unit and the animation drawn on it. A letter animation on a label past
 * the letter limit runs on words (Scramble, which needs letters, becomes Typewriter); past the word
 * limit every animation runs on the whole block, reveals as Focus and loops as Glow.
 */
export function planTextAnimation(
  texts: readonly string[],
  animation: TextAnimation,
  seed: string,
): TextAnimPlan {
  const letters = texts.reduce((n, t) => n + graphemes(t).filter((g) => !isSpace(g)).length, 0);
  const words = texts.reduce((n, t) => n + wordsOf(t).filter((w) => !isSpace(w)).length, 0);
  const wanted: TextAnimMode = LETTER_ANIMS.has(animation)
    ? 'letters'
    : WORD_ANIMS.has(animation)
      ? 'words'
      : 'block';
  let mode = wanted;
  let drawn = animation;
  if (mode === 'letters' && letters > TEXT_ANIM_MAX_LETTERS) {
    mode = 'words';
    if (animation === 'scramble') drawn = 'typewriter';
  }
  if (mode === 'words' && words > TEXT_ANIM_MAX_WORDS) {
    mode = 'block';
    drawn = REVEALS.has(animation) ? 'focus' : 'glow';
  }
  const count = mode === 'letters' ? letters : mode === 'words' ? words : 1;
  return { animation: drawn, mode, count: Math.max(1, count), seed };
}

const STAND_INS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*?@';

/** A deterministic stand-in glyph for Scramble's slot `k` of unit `i`. */
export function scrambleGlyph(seed: string, i: number, k: number): string {
  return STAND_INS[fnv1aString(`${seed}:${i}:${k}`) % STAND_INS.length]!;
}

/** Whether unit `i` flickers, and its phase in [0, 1) when it does. */
export function flickerPhase(seed: string, i: number): number | undefined {
  const h = fnv1aString(`${seed}:flick:${i}`);
  if ((h % 1000) / 1000 >= FLICKER_SHARE && i !== 0) return undefined;
  return (h % 997) / 997;
}

/**
 * Renders one run of text as units, numbering them from `counter.next` (shared across runs so the
 * index runs through a rich label). Whitespace stays plain text, so wrapping is unchanged; in
 * letters mode each word is a no-wrap group so a word never breaks across lines mid-animation.
 */
export function renderUnits(
  text: string,
  plan: TextAnimPlan,
  counter: { next: number },
  keyPrefix = '',
): ReactNode[] {
  if (plan.mode === 'block') {
    const i = counter.next;
    counter.next = 1;
    return [
      <span key={`${keyPrefix}b`} className="lvd-tx-unit" style={unitStyle(i)} aria-hidden>
        {text}
      </span>,
    ];
  }
  const out: ReactNode[] = [];
  wordsOf(text).forEach((word, w) => {
    if (isSpace(word)) {
      out.push(word);
      return;
    }
    if (plan.mode === 'words') {
      const i = counter.next++;
      out.push(
        <span
          key={`${keyPrefix}${w}`}
          className="lvd-tx-unit"
          style={unitStyle(i)}
          data-last={i === plan.count - 1 ? '' : undefined}
          aria-hidden
        >
          {word}
        </span>,
      );
      return;
    }
    out.push(
      <span key={`${keyPrefix}${w}`} className="lvd-tx-word" aria-hidden>
        {graphemes(word).map((g, j) => {
          const i = counter.next++;
          return <Letter key={j} glyph={g} i={i} plan={plan} />;
        })}
      </span>,
    );
  });
  return out;
}

function Letter({ glyph, i, plan }: { glyph: string; i: number; plan: TextAnimPlan }) {
  const flick = plan.animation === 'flicker' ? flickerPhase(plan.seed, i) : undefined;
  return (
    <span
      className="lvd-tx-unit"
      style={flick === undefined ? unitStyle(i) : { ...unitStyle(i), ['--h' as string]: flick }}
      data-last={i === plan.count - 1 ? '' : undefined}
      data-flick={flick === undefined ? undefined : ''}
      data-a={plan.animation === 'scramble' ? scrambleGlyph(plan.seed, i, 0) : undefined}
      data-b={plan.animation === 'scramble' ? scrambleGlyph(plan.seed, i, 1) : undefined}
    >
      {glyph}
    </span>
  );
}

const unitStyle = (i: number) => ({ ['--i' as string]: i });

/** How many units `renderUnits` numbers for this text under the plan. */
export function unitCount(text: string, plan: TextAnimPlan): number {
  if (plan.mode === 'block') return 0;
  const words = wordsOf(text).filter((w) => !isSpace(w));
  return plan.mode === 'words' ? words.length : words.reduce((n, w) => n + graphemes(w).length, 0);
}
