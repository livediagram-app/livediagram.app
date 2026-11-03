import { ctaHref } from '@livehuddle/api-schema';
import { ChevronRightIcon } from '@livehuddle/ui';
import { HeroSpaceStage } from './HeroSpaceStage';

// The landing page's hero (docs/specs/019-marketing/marketing-site.md "Hero"), a Space filling up: a band in the
// brand mark's colours (@livehuddle/ui hero-band.css, shared with the help centre) under the canvas's dot grid,
// the promise badges, the pitch, its two calls to action, then the stage overlapping the band's foot: the real
// Team Pod with the team walking in (HeroSpaceStage). Everything here is server-rendered and the stage moves on
// CSS alone, so the hero ships no JavaScript.
const BADGE =
  'inline-flex items-center gap-2 rounded-full border border-(--hero-chip-border) bg-(--hero-chip-bg) px-3.5 py-1.5 text-sm font-medium text-(--hero-chip-text)';

const PRIMARY =
  'inline-flex h-12 items-center gap-1.5 rounded-xl bg-(--hero-cta) pl-5 pr-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/15 transition-colors hover:bg-(--hero-cta-hover) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--hero-ring-focus)';
const SECONDARY =
  'inline-flex h-12 items-center rounded-xl border border-(--hero-chip-border) bg-(--hero-chip-bg) px-5 text-base font-semibold text-(--hero-chip-text) transition-colors hover:border-(--hero-chip-border-hover) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--hero-ring-focus)';

export function Hero() {
  return (
    <section className="hero-band relative overflow-hidden bg-(--hero-bg) text-(--hero-ink)">
      <div aria-hidden className="hero-band-dots pointer-events-none absolute inset-0" />
      {/* The page's own ground under the stage's lower half, so the window stands across the band's foot. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-slate-50 dark:bg-slate-950"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 pt-12 text-center sm:px-6 sm:pt-16 lg:pt-20">
        {/* Two promises, each its own badge and each true today. A phone keeps the first, so the row stays one line. */}
        <ul aria-label="Our promises" className="flex justify-center gap-2.5">
          <li className={BADGE}>
            <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
            Free and open source
          </li>
          <li className={`${BADGE} max-sm:hidden`}>
            <span aria-hidden className="h-2 w-2 rounded-full bg-teal-500" />
            No sign-up to start
          </li>
        </ul>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-[clamp(2.5rem,6.5vw,4.5rem)] font-semibold leading-[1.02] tracking-tight">
          Meet and run workshops together
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-(--hero-muted) sm:text-xl">
          Walk into a Space as yourself, gather round the table, and run the session on the same
          board: timers, votes and polls built in. Share one link and everyone&rsquo;s in.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href={ctaHref('/new', 'Home.Hero')} className={PRIMARY}>
            Open a Space
            <ChevronRightIcon size={18} aria-hidden />
          </a>
          <a href="/#templates" className={SECONDARY}>
            Browse Templates
          </a>
        </div>
        <div className="relative mx-auto mt-10 max-w-6xl pb-10 text-left sm:mt-12 sm:pb-16">
          {/* A soft emerald light under the window, as the brand's prism glows. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[8%] top-[6%] bottom-[12%] rounded-[40%] bg-[radial-gradient(closest-side,rgb(16_185_129/0.28),transparent)] dark:bg-[radial-gradient(closest-side,rgb(16_185_129/0.16),transparent)]"
          />
          <div className="relative">
            <HeroSpaceStage />
          </div>
        </div>
      </div>
    </section>
  );
}
