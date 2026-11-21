import { ctaHref } from '@liveknowledge/api-schema';
import { ChevronRightIcon, GlyphDisc, RAIL_CLEAR_PADDING } from '@liveknowledge/ui';
import { CtaLink } from '@liveworkspace/marketing-site/components/CtaLink';
import { EYEBROW } from '@liveworkspace/marketing-site/lib/eyebrow';
import type { CSSProperties } from 'react';

import { CATEGORY_ICONS } from '@/components/category-icons';
import type { LandingSection } from '@/lib/landing-content';

// The band at the top of a /features/<id> page (docs/specs/019-marketing/marketing-site.md "Feature pages"): the
// section's glyph and plain name, its heading as the page's h1, its description and the way in, beside the same
// drawing its landing beat shows, so arriving from the beat reads as a continuation. The pieces ease in one beat
// apart (page-motion.css `.enter`), still under reduced motion.
const ENTER_BEAT_MS = 35;
const delay = (index: number) =>
  ({ '--enter-delay': `${Math.min(index * ENTER_BEAT_MS, 130)}ms` }) as CSSProperties;

export function FeatureCategoryHero({ section }: { section: LandingSection }) {
  const Icon = CATEGORY_ICONS[section.id];
  return (
    <section className="border-b border-slate-200/70 bg-gradient-to-b from-brand-50/70 to-white dark:border-slate-800/70 dark:from-brand-500/15 dark:to-slate-950">
      <div
        className={`mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-10 ${RAIL_CLEAR_PADDING} py-14 sm:py-20 lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[27rem_minmax(0,1fr)]`}
      >
        {/* Centred while the band is one column, as the landing beats are. */}
        <div className="text-center lg:text-left">
          <p
            className={`enter flex items-center justify-center gap-3 lg:justify-start ${EYEBROW}`}
            style={delay(0)}
          >
            {Icon ? (
              <GlyphDisc aria-hidden className="h-8 w-8 bg-brand-700 text-white">
                <Icon size={16} aria-hidden />
              </GlyphDisc>
            ) : null}
            {section.label}
          </p>
          <h1
            className="enter mt-4 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl dark:text-slate-100"
            style={delay(1)}
          >
            {section.title}
          </h1>
          <p
            className="enter mt-5 text-lg leading-relaxed text-pretty text-slate-600 dark:text-slate-300"
            style={delay(2)}
          >
            {section.description}
          </p>
          <div className="enter mt-8" style={delay(3)}>
            <CtaLink href={ctaHref('/new', 'Feature.Hero')} className="group">
              Start a Knowledgebase
              <ChevronRightIcon
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </CtaLink>
          </div>
        </div>
        {/* From lg only: on a phone the drawing would push the cards a screen down, and the beat's words above
            already say what it shows. */}
        <div className="enter hidden lg:block" style={delay(4)}>
          {section.art}
        </div>
      </div>
    </section>
  );
}
