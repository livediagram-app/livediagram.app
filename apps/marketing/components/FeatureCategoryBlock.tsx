import { CtaLink } from '@/components/CtaLink';
import type { LandingSection } from '@/lib/landing-content';
import { SectionShowcase } from '@/components/SectionShowcase';

// A landing-page advertising block for one feature category. Instead of
// enumerating every feature card inline (which made the page feel cluttered,
// see spec/16), each section is pitched as a self-contained band: its
// headline, one-line positioning, a badge for every feature it covers (so the
// breadth is scannable at a glance without the heavy cards), a taller
// animated showcase composed from the section's own feature mocks, and an
// "Explore ..." link into the category's own /features/<id> page where the
// full grid lives.
//
// The showcase side alternates left/right by index and the background
// alternates tinted/plain, so a run of these reads as a composed page rather
// than a stack of identical grids.

export function FeatureCategoryBlock({
  section,
  index,
}: {
  section: LandingSection;
  index: number;
}) {
  const tinted = index % 2 === 1;
  const artFirst = index % 2 === 1;

  return (
    <section
      id={section.id}
      className={`border-t border-slate-200/70 ${tinted ? 'bg-brand-50/60' : 'bg-white'}`}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:gap-16">
        {/* Pitch */}
        <div className={artFirst ? 'lg:order-2' : ''}>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {section.title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">{section.description}</p>

          {/* A badge per feature: the whole category at a glance, no cards.
              Hidden on mobile, where they only add height and echo the showcase. */}
          <ul className="mt-6 hidden flex-wrap gap-2 sm:flex">
            {section.items.map((item) => (
              <li
                key={item.title}
                className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-sm text-slate-600"
              >
                {item.title}
              </li>
            ))}
          </ul>

          <CtaLink href={`/features/${section.id}`} className="group mt-8 gap-2">
            {section.cta}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            >
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </CtaLink>
        </div>

        {/* Taller showcase composed from the section's own feature mocks.
            Hidden below the two-column breakpoint: on mobile it eats the screen
            and just restates the pitch beside it. */}
        <div className={`hidden lg:block ${artFirst ? 'lg:order-1' : ''}`}>
          <SectionShowcase section={section} />
        </div>
      </div>
    </section>
  );
}
