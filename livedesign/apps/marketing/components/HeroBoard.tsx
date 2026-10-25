'use client';

import { ctaHref } from '@livedesign/api-schema';
import { TemplatePreview } from '@livedesign/template-previews';
import { templateCreateHref, type TemplateKind } from '@livedesign/templates';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { boardHand, HERO_BOARD_OPENING, heroTemplate } from '@/lib/hero-starts';
import { createLabelPrefix } from '@/lib/create-label';

// The moodboard round the hero's card from `xl` (docs/specs/019-marketing/marketing-site.md "Hero"): six
// template cards, three a side along the band's outer edges, each the picker's preview over its title on a
// tilted white card and a link creating its template, with four decorative pieces peeking out above and
// below the card. Every place is measured from the band's middle (the card is 42.5rem wide, 7.5rem down),
// so the collage hugs the card on any wide screen; from `2xl` the card widens by 7.5rem and the collage moves
// out with it (`--spread`, half that growth: the pieces by it, the cards by half as much again). The static HTML is a fixed opening hand, hidden once
// script runs (<html data-hero-deal>) until this visit's shuffled six replace it; after that it holds
// still. It sits behind the copy.

const at = (rem: number, spread = 1) =>
  `calc(50% ${rem < 0 ? '-' : '+'} (${Math.abs(rem)}rem + ${spread} * var(--spread)))`;

// Where each card sits, as the picked mockup lays them on a 1280px band: the left column 30-60px in from
// its edge, the right ending as far from the other.
const SLOTS: readonly { left: string; top: string; width: string; tilt: string }[] = [
  { left: at(-38.125, 1.5), top: '2.5rem', width: '12.5rem', tilt: '-3deg' },
  { left: at(-37.5, 1.5), top: '18.75rem', width: '13.75rem', tilt: '2deg' },
  { left: at(-36.25, 1.5), top: '35rem', width: '11.875rem', tilt: '-2deg' },
  { left: at(25, 1.5), top: '2.5rem', width: '12.5rem', tilt: '3deg' },
  { left: at(24.375, 1.5), top: '18.75rem', width: '13.75rem', tilt: '-2deg' },
  { left: at(26.25, 1.5), top: '35rem', width: '11.875rem', tilt: '2deg' },
];

const SWATCHES = ['bg-rose-300', 'bg-rose-500', 'bg-rose-700', 'bg-rose-900'];

const PIECE =
  'absolute h-24 w-[9.375rem] rounded-[0.875rem] shadow-[0_22px_40px_-22px_var(--hero-card-shadow)]';

const piece = (left: number, top: string, tilt: string): CSSProperties => ({
  left: at(left),
  top,
  transform: `rotate(${tilt})`,
});

export function HeroBoard() {
  const [hand, setHand] = useState<TemplateKind[]>(() => [...HERO_BOARD_OPENING]);
  const [dealt, setDealt] = useState(false);
  const dealtHand = useRef<TemplateKind[]>(hand);

  // This visit's six, read in an effect: the static HTML has to be one hand for everyone, so the
  // shuffle cannot happen in render.
  useEffect(() => {
    dealtHand.current = boardHand(Math.random);
    setHand(dealtHand.current);
    setDealt(true);
  }, []);

  return (
    <div
      data-dealt={dealt ? '' : undefined}
      className="hero-board pointer-events-none absolute inset-0 hidden overflow-hidden [--spread:0rem] xl:block 2xl:[--spread:3.75rem]"
    >
      <div aria-hidden>
        <div
          className={`${PIECE} flex gap-1 border border-rose-100 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900`}
          style={piece(-23.125, '1.25rem', '4deg')}
        >
          {SWATCHES.map((s) => (
            <span key={s} className={`flex-1 rounded-md ${s}`} />
          ))}
        </div>
        <div
          className={`${PIECE} bg-linear-to-br from-rose-300 to-rose-700`}
          style={piece(13.75, '1.5rem', '-3deg')}
        />
        <div
          className={`${PIECE} bg-[radial-gradient(circle_at_30%_40%,var(--color-rose-200),var(--color-rose-500))]`}
          style={piece(-23.125, '40.625rem', '3deg')}
        />
        <div
          className={`${PIECE} flex h-[6.875rem] w-[8.75rem] items-center justify-center border border-rose-100 bg-white font-serif text-[3.5rem] font-semibold text-(--hero-ink) dark:border-slate-800 dark:bg-slate-900`}
          style={piece(14.375, '40rem', '-5deg')}
        >
          Aa
        </div>
      </div>
      {hand.map((kind, i) => {
        const slot = SLOTS[i];
        if (!slot) return null;
        const t = heroTemplate(kind);
        return (
          <a
            key={kind}
            href={ctaHref(templateCreateHref(kind), 'Home.HeroBoard')}
            style={
              {
                left: slot.left,
                top: slot.top,
                width: slot.width,
                '--tilt': slot.tilt,
              } as CSSProperties
            }
            className="pointer-events-auto absolute flex cursor-pointer flex-col gap-1.5 rounded-[0.875rem] border border-rose-100 bg-white p-1.5 text-slate-900 shadow-[0_22px_40px_-22px_var(--hero-card-shadow)] outline-none transition-[transform,box-shadow] duration-micro ease-out [transform:rotate(var(--tilt))] hover:shadow-[0_30px_50px_-24px_var(--hero-card-shadow)] hover:[transform:translateY(-0.375rem)_rotate(0deg)] focus-visible:[transform:translateY(-0.375rem)_rotate(0deg)] focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:border-transparent"
          >
            <span className="flex aspect-[8/5] items-center justify-center rounded-[0.5625rem] bg-slate-50 [&>svg]:h-[80%] [&>svg]:w-auto">
              <TemplatePreview kind={kind} />
            </span>
            <span className="truncate px-1 pb-0.5 text-[0.8125rem] font-semibold">
              <span className="sr-only">{createLabelPrefix(t.title)}</span>
              {t.title}
            </span>
          </a>
        );
      })}
    </div>
  );
}
