import { ctaHref } from '@liveknowledge/api-schema';
import { ChevronRightIcon } from '@liveknowledge/ui';

import { HERO_HEADLINE, PITCH_LINE } from '@/lib/site-words';
import { HeroIllustration } from './HeroIllustration';

// The landing page's hero (docs/specs/019-marketing/marketing-site.md "Hero"): what liveknowledge is, the two ways
// in, and its illustration. A band in the brand mark's lime (@liveknowledge/ui hero-band.css, shared with the help
// centre) over the dot grid. Two columns from lg (the copy, then the drawing); one column below, the drawing under
// the copy. Static markup: its motion is CSS (app/hero-animations.css), so it ships no script.
const BADGE =
  'inline-flex items-center gap-2 rounded-full border border-(--hero-chip-border) bg-(--hero-chip-bg) px-3.5 py-1.5 text-sm font-medium text-(--hero-chip-text)';

// Both buttons are 48px tall at every width, so each is a full touch target on a phone.
const BUTTON =
  'inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-6 text-base font-semibold transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hero-ring-focus)';

export function Hero() {
  return (
    // From `sm` it fills the first screen under the header, up to a cap (hero-tall.css in
    // @liveworkspace/marketing-site), the extra shared above and below the content.
    <section className="hero-band hero-tall relative overflow-hidden bg-(--hero-bg) text-(--hero-ink)">
      <div aria-hidden className="hero-band-dots pointer-events-none absolute inset-0" />
      <div className="hero-tall-copy relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12">
          <div className="text-center lg:text-left">
            {/* Two promises, each true today. A phone keeps the first only, so the row stays one line. */}
            <ul aria-label="Our promises" className="flex justify-center gap-2.5 lg:justify-start">
              <li className={BADGE}>
                <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
                Free and Open Source
              </li>
              <li className={`${BADGE} max-sm:hidden`}>
                <span aria-hidden className="h-2 w-2 rounded-full bg-brand-500" />
                No Sign-Up to Start
              </li>
            </ul>
            <h1 className="mt-7 text-[clamp(2.25rem,5.2vw,3.75rem)] leading-[1.05] font-semibold tracking-tight text-balance">
              {HERO_HEADLINE}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-(--hero-muted) sm:text-xl lg:mx-0">
              {PITCH_LINE} Every page has an owner and a verified date, every answer names its
              source, and your agents read the same pages under the same rules.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
              <a
                href={ctaHref('/new', 'Home.Hero')}
                className={`${BUTTON} bg-(--hero-cta) text-white hover:bg-(--hero-cta-hover)`}
              >
                <span className="text-optical-centre">Start a Knowledgebase</span>
                <ChevronRightIcon size={16} aria-hidden />
              </a>
              <a
                href="#import"
                className={`${BUTTON} border border-(--hero-chip-border) bg-(--hero-chip-bg) text-(--hero-chip-text) hover:border-(--hero-chip-border-hover)`}
              >
                <span className="text-optical-centre">Import From Notion or Confluence</span>
              </a>
            </div>
          </div>
          {/* The drawing keeps its 6:5 box at every width, so nothing shifts as it paints, and rests while off
              screen (content-visibility). Capped on a phone and a tablet so it never outgrows the copy. */}
          <div className="mx-auto aspect-[6/5] w-full max-w-xl [content-visibility:auto] lg:max-w-none">
            <HeroIllustration className="h-full w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
