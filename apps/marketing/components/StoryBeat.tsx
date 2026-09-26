import { ChevronRightIcon } from '@livediagram/ui';
import { CATEGORY_ICONS } from '@/components/category-icons';
import { CtaLink } from '@/components/CtaLink';
import { Showcase } from '@/components/Showcase';
import { beatSections, beatShowcase, type LandingBeat } from '@/lib/landing-beats';

// One beat of the landing page's story (spec/16): the beat's headline with
// its number beside it, its pitch, a chip into every category it covers (so all of
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
          {/* The beat's number sits beside its title, centred on the whole
              block, so a title that wraps to two lines stays balanced. */}
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white tabular-nums sm:h-10 sm:w-10"
            >
              {number}
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">
              {beat.title}
            </h2>
          </div>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-slate-600">
            {beat.description}
          </p>

          {/* A chip per category this beat covers, each into its own page,
              with how many features wait there. */}
          <ul className="mt-6 flex flex-wrap gap-2" aria-label={`Inside ${beat.title}`}>
            {sections.map((section) => {
              const Icon = CATEGORY_ICONS[section.id];
              return (
                <li key={section.id}>
                  <a
                    href={`/features/${section.id}`}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 py-1 pr-2 pl-2.5 text-sm text-slate-700 shadow-xs transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    {Icon ? (
                      <Icon className="text-brand-500 transition group-hover:text-brand-600" />
                    ) : null}
                    {section.label}
                    <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-500 tabular-nums transition group-hover:bg-brand-50 group-hover:text-brand-700">
                      {section.items.length}
                    </span>
                  </a>
                </li>
              );
            })}
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
