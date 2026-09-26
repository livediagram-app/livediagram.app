import { ChevronRightIcon } from '@livediagram/ui';
import { CtaLink } from '@/components/CtaLink';
import { Showcase } from '@/components/Showcase';
import { beatSections, beatShowcase, type LandingBeat } from '@/lib/landing-beats';

// One beat of the landing page's story (spec/16): a numbered eyebrow, the
// beat's headline and pitch, a chip into every category it covers (so all of
// them stay one click from home), a primary link into its lead category, and
// a showcase with one scene from across the beat. Alternates the showcase
// side and the tinted background by index so the run reads as a composed page.

export function StoryBeat({ beat, index }: { beat: LandingBeat; index: number }) {
  const sections = beatSections(beat);
  const lead = sections[0]!;
  const tinted = index % 2 === 1;
  const artFirst = index % 2 === 1;
  const number = String(index + 1).padStart(2, '0');

  return (
    <section
      id={beat.id}
      className={`scroll-mt-20 border-t border-slate-200/70 ${tinted ? 'bg-brand-50/60' : 'bg-white'}`}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div className={artFirst ? 'lg:order-2' : ''}>
          <p className="flex items-center gap-3 text-sm font-semibold tracking-wide text-brand-600 uppercase">
            <span
              aria-hidden
              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-500 px-1.5 text-xs font-semibold text-white tabular-nums"
            >
              {number}
            </span>
            {beat.eyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">
            {beat.title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-slate-600">
            {beat.description}
          </p>

          {/* A chip per category this beat covers, each into its own page,
              with how many features wait there. */}
          <ul className="mt-6 flex flex-wrap gap-2" aria-label={`Inside ${beat.eyebrow}`}>
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`/features/${section.id}`}
                  className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 py-1 pr-2 pl-3 text-sm text-slate-700 shadow-xs transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {section.label}
                  <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-500 tabular-nums transition group-hover:bg-brand-50 group-hover:text-brand-700">
                    {section.items.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <CtaLink href={`/features/${lead.id}`} className="group mt-8">
            {beat.cta}
            <ChevronRightIcon
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </CtaLink>
        </div>

        {/* Hidden below the two-column breakpoint: stacked on mobile it eats
            the screen and restates the pitch above it. */}
        <div className={`hidden lg:block ${artFirst ? 'lg:order-1' : ''}`}>
          <Showcase items={beatShowcase(beat)} />
        </div>
      </div>
    </section>
  );
}
