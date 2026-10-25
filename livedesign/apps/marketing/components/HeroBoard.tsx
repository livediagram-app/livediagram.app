'use client';

import { ctaHref } from '@livedesign/api-schema';
import { TemplatePreview } from '@livedesign/template-previews';
import { templateCreateHref, type TemplateKind } from '@livedesign/templates';
import { useEffect, useState, type CSSProperties } from 'react';
import { boardHand, HERO_BOARD_OPENING, heroTemplate } from '@/lib/hero-starts';
import { createLabelPrefix } from '@/lib/create-label';

// The moodboard round the hero's card from `xl` (docs/specs/019-marketing/marketing-site.md "Hero"): six
// template cards, three a side, each the picker's preview on a tilted white card and a link creating its
// template, with four decorative pieces tucked half under the card's edges. Every place is measured from
// the band's middle (the card is 56rem wide), so the collage hugs the card on any wide screen. The static
// HTML is a fixed opening hand, hidden once script runs (<html data-hero-deal>) until this visit's
// shuffled six replace it; after that it holds still. It sits behind the copy, so the card covers what
// it tucks under.

// Where each card sits: the left column ends 1rem short of the card, the right starts 1rem past it.
const LEFT = 'calc(50% - 39rem)';
const RIGHT = 'calc(50% + 29rem)';
const SLOTS: readonly { left: string; top: string; tilt: string }[] = [
  { left: LEFT, top: '4rem', tilt: '-4deg' },
  { left: LEFT, top: '17rem', tilt: '3deg' },
  { left: LEFT, top: '30rem', tilt: '-2deg' },
  { left: RIGHT, top: '3rem', tilt: '3deg' },
  { left: RIGHT, top: '16rem', tilt: '-3deg' },
  { left: RIGHT, top: '29rem', tilt: '2deg' },
];

const SWATCHES = ['bg-rose-200', 'bg-rose-400', 'bg-rose-600', 'bg-rose-900'];

const piece = (left: string, top: string, tilt: string): CSSProperties => ({
  left,
  top,
  transform: `rotate(${tilt})`,
});

export function HeroBoard() {
  const [hand, setHand] = useState<TemplateKind[]>(() => [...HERO_BOARD_OPENING]);
  const [dealt, setDealt] = useState(false);

  // This visit's six, read in an effect: the static HTML has to be one hand for everyone.
  useEffect(() => {
    setHand(boardHand(Math.random));
    setDealt(true);
  }, []);

  return (
    <div
      data-dealt={dealt ? '' : undefined}
      className="hero-board pointer-events-none absolute inset-0 hidden overflow-hidden xl:block"
    >
      <div aria-hidden>
        <div
          className="absolute flex h-[5.5rem] w-36 gap-1 rounded-xl border border-rose-100 bg-white p-1.5 shadow-[0_20px_40px_-24px_var(--hero-card-shadow)] dark:border-slate-800 dark:bg-slate-900"
          style={piece('calc(50% - 32rem)', '12.5rem', '5deg')}
        >
          {SWATCHES.map((s) => (
            <span key={s} className={`flex-1 rounded-md ${s}`} />
          ))}
        </div>
        <div
          className="absolute h-20 w-32 rounded-xl bg-linear-to-br from-rose-300 to-rose-700 shadow-[0_20px_40px_-24px_var(--hero-card-shadow)]"
          style={piece('calc(50% - 31rem)', '38rem', '3deg')}
        />
        <div
          className="absolute flex h-28 w-32 items-center justify-center rounded-xl border border-rose-100 bg-white font-serif text-6xl font-semibold text-(--hero-ink) shadow-[0_20px_40px_-24px_var(--hero-card-shadow)] dark:border-slate-800 dark:bg-slate-900"
          style={piece('calc(50% + 24rem)', '12.5rem', '-5deg')}
        >
          Aa
        </div>
        <div
          className="absolute size-24 rounded-full bg-[radial-gradient(circle_at_30%_35%,var(--color-rose-200),var(--color-rose-500))] shadow-[0_20px_40px_-24px_var(--hero-card-shadow)]"
          style={piece('calc(50% + 25rem)', '37rem', '0deg')}
        />
      </div>
      {hand.map((kind, i) => {
        const slot = SLOTS[i];
        if (!slot) return null;
        const t = heroTemplate(kind);
        return (
          <a
            key={kind}
            href={ctaHref(templateCreateHref(kind), 'Home.HeroBoard')}
            style={{ left: slot.left, top: slot.top, '--tilt': slot.tilt } as CSSProperties}
            className="pointer-events-auto absolute flex w-40 flex-col gap-2 rounded-xl border border-rose-100 bg-white p-2.5 text-slate-900 shadow-[0_30px_60px_-30px_var(--hero-card-shadow)] outline-none transition-transform duration-micro ease-out [transform:rotate(var(--tilt))] hover:[transform:translateY(-0.375rem)_rotate(0deg)] focus-visible:[transform:translateY(-0.375rem)_rotate(0deg)] focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:border-transparent"
          >
            <span className="truncate text-xs font-semibold">
              <span className="sr-only">{createLabelPrefix(t.title)}</span>
              {t.title}
            </span>
            <span className="flex h-24 items-center justify-center rounded-lg bg-slate-50 [&>svg]:h-20 [&>svg]:w-auto">
              <TemplatePreview kind={kind} />
            </span>
          </a>
        );
      })}
    </div>
  );
}
