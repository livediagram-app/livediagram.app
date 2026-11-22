import { ctaHref } from '@liveknowledge/api-schema';
import { ChevronRightIcon } from '@liveknowledge/ui';

import { HERO_HEADLINE, HERO_LEAD } from '@/lib/site-words';
import { HeroImport } from './hero/HeroImport';
import { HeroBackdrop } from './HeroBackdrop';
import { HeroIllustration } from './HeroIllustration';

// The landing page's hero (docs/specs/019-marketing/marketing-site.md "Hero"): what liveknowledge is, the two ways
// in, and its illustration. A band in the brand mark's lime (@liveknowledge/ui hero-band.css, shared with the help
// centre) over the dot grid and a drawn backdrop (HeroBackdrop). Two columns from lg (the copy, then the drawing);
// one column below, the drawing under the copy. Its motion is CSS (app/hero-animations.css); its one script is the
// Import marks' tooltips.
const BADGE =
  'inline-flex items-center gap-2 rounded-full border border-(--hero-chip-border) bg-(--hero-chip-bg) px-3.5 py-1.5 text-sm font-medium text-(--hero-chip-text)';

// 48px tall at every width, so it is a full touch target on a phone, as the Import capsule beside it is.
const BUTTON =
  'inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-6 text-base font-semibold transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hero-ring-focus)';

// The headline's last word sits under a lime marker stroke ("trust"), its full stop outside it.
const [, HEAD, LAST, STOP] = /^(.*\s)(\S+?)([.!?]?)$/.exec(HERO_HEADLINE) ?? [
  '',
  HERO_HEADLINE,
  '',
  '',
];

export function Hero() {
  return (
    // From `sm` it takes the shared screen-filling height (hero-tall.css in @liveworkspace/marketing-site) under a
    // lower cap of its own, so the template band shows under it on a laptop.
    <section className="hero-band hero-tall relative overflow-hidden bg-(--hero-bg) text-(--hero-ink) [--hero-tall-cap:46rem]">
      <div aria-hidden className="hero-band-dots pointer-events-none absolute inset-0" />
      <HeroBackdrop />
      <div className="hero-tall-copy relative mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] lg:gap-12">
          <div className="text-center lg:text-left">
            {/* Two promises, each true today. A phone keeps the first only, so the row stays one line. */}
            <ul aria-label="Our promises" className="flex justify-center gap-2.5 lg:justify-start">
              <li className={BADGE}>
                <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
                Open Source
              </li>
              <li className={`${BADGE} max-sm:hidden`}>
                <span aria-hidden className="h-2 w-2 rounded-full bg-brand-500" />
                No Sign-Up to Start
              </li>
            </ul>
            <h1 className="mt-6 text-[clamp(2.25rem,4.6vw,3.4rem)] leading-[1.05] font-semibold tracking-tight text-balance">
              {HEAD}
              <span className="relative whitespace-nowrap">
                <span
                  aria-hidden
                  className="absolute inset-x-[-0.06em] bottom-[0.04em] h-[0.36em] -rotate-1 rounded-[0.12em] bg-brand-200 dark:bg-brand-500/40"
                />
                <span className="relative">{LAST}</span>
              </span>
              {STOP}
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-pretty text-(--hero-muted) sm:text-xl lg:mx-0">
              {HERO_LEAD}
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
              <a
                href={ctaHref('/new', 'Home.Hero')}
                className={`${BUTTON} bg-(--hero-cta) text-white hover:bg-(--hero-cta-hover)`}
              >
                <span className="text-optical-centre">Start a Knowledgebase</span>
                <ChevronRightIcon size={16} aria-hidden />
              </a>
              <HeroImport />
            </div>
          </div>
          {/* The drawing keeps its 6:5 box at every width, so nothing shifts as it paints, and rests while off
              screen (content-visibility). Capped so it never outgrows the copy, and the band stays short. */}
          <div className="mx-auto aspect-[6/5] w-full max-w-md [content-visibility:auto] sm:max-w-lg lg:max-w-none">
            <HeroIllustration className="h-full w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
