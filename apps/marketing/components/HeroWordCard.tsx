import { lucideFileText, lucideLightbulb, lucidePencilLine } from '@livediagram/icons/lucide';
import {
  FlowchartIcon,
  IllustrateIcon,
  MarkerIcon,
  lucideGlyph,
  type IconProps,
} from '@livediagram/ui';
import type { ComponentType, Ref } from 'react';

// The card under the hero's cycling word (docs/specs/019-marketing/marketing-site.md "Hero"): every
// word the headline cycles through, as a chip with its glyph, the one showing in brand. The modes'
// words wear the editor's mode-switch glyphs (Diagram, Whiteboard, Illustrate), so the card reads
// as the product. A pointer on top aims at the word; it stays on the word when the card is nudged
// inside a phone's edge (--hero-card-nudge, set by HeroTitleLine).

export const HERO_WORDS: readonly { word: string; Icon: ComponentType<IconProps> }[] = [
  { word: 'Diagram', Icon: FlowchartIcon },
  { word: 'Document', Icon: lucideGlyph(lucideFileText, 16) },
  { word: 'Write', Icon: lucideGlyph(lucidePencilLine, 16) },
  { word: 'Whiteboard', Icon: MarkerIcon },
  { word: 'Illustrate', Icon: IllustrateIcon },
  { word: 'Brainstorm', Icon: lucideGlyph(lucideLightbulb, 16) },
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
    // Outside the word slot so its clip cannot cut it; pt-3 leaves room for the pointer.
    <span
      ref={cardRef}
      className="absolute top-full z-10 mt-1 w-max -translate-x-1/2 animate-fade-in pt-3 text-left text-sm font-normal tracking-normal motion-reduce:animate-none"
      style={{ left }}
    >
      <span className="block rounded-xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-950/50">
        <span className="block px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          One canvas for
        </span>
        <span className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {HERO_WORDS.map(({ word, Icon }, i) => (
            <span
              key={word}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-medium transition-colors duration-micro ${
                i === shown
                  ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <Icon
                size={16}
                aria-hidden
                className={
                  i === shown
                    ? 'shrink-0 text-brand-600 dark:text-brand-300'
                    : 'shrink-0 text-slate-400 dark:text-slate-500'
                }
              />
              {word}
            </span>
          ))}
        </span>
        <span className="mt-2 block border-t border-slate-100 px-1 pt-2 text-xs leading-relaxed text-slate-500 dark:border-slate-700/70 dark:text-slate-400">
          Whatever you&rsquo;re making, make it together.
        </span>
      </span>
      {/* Painted over the card's top edge, so the border runs into the pointer. */}
      <span
        aria-hidden
        className="absolute left-1/2 top-[7px] h-3 w-3 translate-x-[calc(-50%+var(--hero-card-nudge,0px))] rotate-45 rounded-tl-[3px] border-l border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      />
    </span>
  );
}
