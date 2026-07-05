import { CtaLink } from '@/components/CtaLink';
import type { LandingSection } from '@/lib/landing-content';
import { SectionShowcase } from '@/components/SectionShowcase';

// The hero band at the top of a /features/<id> category page. Replaces the
// bare centred title + description with a two-column pitch: an eyebrow, the
// title, the positioning line, the feature count, the primary CTAs, and the
// section's taller animated showcase beside it, so the detail pages look as
// composed as the landing blocks they came from.

export function FeatureCategoryHero({ section }: { section: LandingSection }) {
  return (
    <section className="border-b border-slate-200/70 bg-gradient-to-b from-brand-50/70 to-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">
            Feature category
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            {section.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">{section.description}</p>
          <div className="mt-8">
            <CtaLink href="/new">Start drawing</CtaLink>
          </div>
        </div>

        {/* Hidden below the two-column breakpoint: on mobile the showcase eats
            the screen and just restates the pitch above it. */}
        <div className="hidden lg:block">
          <SectionShowcase section={section} />
        </div>
      </div>
    </section>
  );
}
