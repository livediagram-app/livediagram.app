import type { ReactNode } from 'react';

// The tinted hero band that opens the marketing content pages (FAQ, the comparison hub and each comparison, the
// pricing page): an eyebrow pill, the h1, a lede, and an optional slot below them (the FAQ's search, a comparison's
// CTA). With `art`, an illustrated hero: the words lead on the left and the art sits beside them where there is room,
// under them on a phone, decorative and hidden from assistive technology. `below` holds what belongs to the hero under
// both (the pricing page's tier cards), in the same band.
const BAND =
  'border-b border-slate-200/70 bg-gradient-to-b from-brand-50/70 to-transparent px-6 dark:border-slate-800/70 dark:from-brand-500/10';
const PILL =
  'inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-brand-700 uppercase ring-1 ring-brand-100 dark:bg-slate-900 dark:text-brand-300 dark:ring-brand-500/20';
const HEADING =
  'mt-4 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl dark:text-slate-100';
const LEDE = 'mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300';

export function PageHero({
  eyebrow,
  title,
  lede,
  art,
  below,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede: ReactNode;
  /** The hero's illustration, beside the words. */
  art?: ReactNode;
  /** Full width under the words and the art, inside the same band (the pricing page's tier cards). */
  below?: ReactNode;
  children?: ReactNode;
}) {
  if (art) {
    return (
      <div className={`${BAND} pt-14 pb-14 sm:pt-16 sm:pb-16`} data-page-hero="illustrated">
        <div className="mx-auto grid max-w-[70rem] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
          <div className="text-center lg:text-left">
            <p className={PILL}>{eyebrow}</p>
            <h1 className={HEADING}>{title}</h1>
            <p className={`${LEDE} text-pretty lg:mx-0`}>{lede}</p>
            {children}
          </div>
          <div aria-hidden className="mx-auto w-full max-w-[22rem] lg:max-w-[26rem]">
            {art}
          </div>
        </div>
        {below ? <div className="mx-auto mt-12 max-w-[70rem] sm:mt-14">{below}</div> : null}
      </div>
    );
  }
  return (
    <div className={`${BAND} pt-16 pb-14 text-center sm:pt-20`}>
      <p className={PILL}>{eyebrow}</p>
      <h1 className={`mx-auto max-w-3xl ${HEADING}`}>{title}</h1>
      <p className={LEDE}>{lede}</p>
      {children}
    </div>
  );
}
