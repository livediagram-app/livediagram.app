import { ctaHref } from '@livediagram/api-schema';
import type { CSSProperties } from 'react';
import { CtaLink } from '@/components/CtaLink';
import type { LandingSection } from '@/lib/landing-content';
import { FeatureScene } from '@/components/FeatureScene';

// The hero band at the top of a /features/<id> category page: a two-column
// pitch (the feature's plain name as the eyebrow, the headline, the positioning
// line, the primary CTA) beside the same hero scene its landing beat plays, so
// arriving from the beat reads as a continuation.

// The hero eases in piece by piece on arrival (page-motion.css `.enter`), so
// landing here from the home page reads as a continuation, not a cut.
// The hero's pieces enter one beat apart (page-motion.css paces the entrance).
const ENTER_BEAT_MS = 35;
const delay = (index: number) =>
  ({ '--enter-delay': `${Math.min(index * ENTER_BEAT_MS, 130)}ms` }) as CSSProperties;

export function FeatureCategoryHero({ section }: { section: LandingSection }) {
  return (
    <section className="border-b border-slate-200/70 bg-gradient-to-b from-brand-50/70 to-white dark:from-brand-500/15 dark:to-slate-950 dark:border-slate-800/70">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[26rem_minmax(0,1fr)]">
        {/* Centred while the hero is one column, as the landing beats are. */}
        <div className="text-center lg:text-left">
          <p
            className="enter text-sm font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-300"
            style={delay(0)}
          >
            {section.label}
          </p>
          <h1
            className="enter mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100"
            style={delay(1)}
          >
            {section.title}
          </h1>
          <p
            className="enter mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-300"
            style={delay(2)}
          >
            {section.description}
          </p>
          <div className="enter mt-8" style={delay(3)}>
            <CtaLink href={ctaHref('/new', 'Feature.Hero')}>Start drawing</CtaLink>
          </div>
        </div>

        {/* Hidden below the two-column breakpoint: on mobile the showcase eats
            the screen and just restates the pitch above it. */}
        <div className="enter hidden lg:block" style={delay(4)}>
          <FeatureScene scene={section.scene} />
        </div>
      </div>
    </section>
  );
}
