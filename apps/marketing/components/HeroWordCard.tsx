import { lucideFileText, lucideLightbulb, lucideUsers } from '@livediagram/icons/lucide';
import {
  FlowchartIcon,
  IllustrateIcon,
  MarkerIcon,
  lucideGlyph,
  type IconProps,
} from '@livediagram/ui';
import type { ComponentType, Ref } from 'react';

// The card under the hero's cycling word (docs/specs/019-marketing/marketing-site.md "Hero"): every
// word the headline cycles through, as a row with its glyph, its name and one line on what it is,
// the word showing in brand. The modes' words wear the editor's mode-switch glyphs (Diagram,
// Whiteboard, Illustrate), so the card reads as the product. A pointer on top aims at the word;
// it stays on the word when the card is nudged inside a phone's edge (--hero-card-nudge, set by
// HeroTitleLine).

// `word` is the headline's ("Diagram together"); `many` is what the card lists, as things one
// canvas is for ("Diagrams"); `what` says what that means here, in a line.
export const HERO_WORDS: readonly {
  word: string;
  many: string;
  what: string;
  Icon: ComponentType<IconProps>;
}[] = [
  {
    word: 'Diagram',
    many: 'Diagrams',
    what: 'Flowcharts, org charts and architecture that connect',
    Icon: FlowchartIcon,
  },
  {
    word: 'Document',
    many: 'Documents',
    what: 'Specs, plans and runbooks, every tab in one place',
    Icon: lucideGlyph(lucideFileText, 16),
  },
  {
    word: 'Workshop',
    many: 'Workshops',
    what: 'Retros, town halls and planning sessions, run live with your team',
    Icon: lucideGlyph(lucideUsers, 16),
  },
  {
    word: 'Whiteboard',
    many: 'Whiteboards',
    what: 'Markers, stickies and doodles on an endless board',
    Icon: MarkerIcon,
  },
  {
    word: 'Illustrate',
    many: 'Illustrations',
    what: 'Infographics, posters and posts, sized to print or share',
    Icon: IllustrateIcon,
  },
  {
    word: 'Brainstorm',
    many: 'Brainstorms',
    what: 'Mind maps and sticky sessions to get every idea out',
    Icon: lucideGlyph(lucideLightbulb, 16),
  },
];

export function HeroWordCard({
  shown,
  left,
  cardRef,
}: {
  shown: number;
  left: number | string;
  cardRef: Ref<HTMLSpanElement>;
}) {
  return (
    // Outside the word slot so its clip cannot cut it; pt-2.5 leaves room for the pointer, which
    // reaches up to the word's underline.
    <span
      ref={cardRef}
      className="absolute top-full z-10 w-max max-w-[calc(100vw-16px)] -translate-x-1/2 animate-fade-in whitespace-normal pt-2.5 text-left text-sm font-normal tracking-normal motion-reduce:animate-none"
      style={{ left }}
    >
      <span className="block rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-950/50">
        <span className="block px-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          One canvas for
        </span>
        <span className="mt-1.5 grid gap-0.5 sm:grid-cols-2">
          {HERO_WORDS.map(({ word, many, what, Icon }, i) => (
            <span
              key={word}
              className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-micro sm:w-64 ${
                i === shown
                  ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:ring-brand-500/30'
                  : ''
              }`}
            >
              <Icon
                size={16}
                aria-hidden
                className={`mt-0.5 shrink-0 ${
                  i === shown
                    ? 'text-brand-600 dark:text-brand-300'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={`font-semibold ${
                    i === shown
                      ? 'text-brand-700 dark:text-brand-200'
                      : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {many}
                </span>
                <span className="text-xs leading-snug text-slate-500 dark:text-slate-400">
                  {what}
                </span>
              </span>
            </span>
          ))}
        </span>
      </span>
      {/* The pointer, painted over the card's top edge so the border runs into it, its tip just
          under the word's dotted underline. */}
      <span
        aria-hidden
        className="absolute left-1/2 top-[3px] h-4 w-4 translate-x-[calc(-50%+var(--hero-card-nudge,0px))] rotate-45 rounded-tl-[4px] border-l border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      />
    </span>
  );
}
