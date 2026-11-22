import { CheckIcon, ChevronRightIcon, GlyphDisc, RAIL_CLEAR_PADDING } from '@liveknowledge/ui';
import { CtaLink } from '@liveworkspace/marketing-site/components/CtaLink';
import { EYEBROW } from '@liveworkspace/marketing-site/lib/eyebrow';

import { CATEGORY_ICONS } from '@/components/category-icons';
import type { LandingSection } from '@/lib/landing-content';

// One beat of the landing page's story (docs/specs/019-marketing/marketing-site.md "Feature sections"): one
// thing liveknowledge does. Its glyph in a disc and its plain name above the headline, two or three sentences,
// three ticked points, a link to its own page (/features/<id>), and its art beside it. The art's side and the tinted ground alternate by index so the run
// reads as a composed page. Below lg the beat is one column, the art under the words: it is the section's
// picture at every width, never hidden on a phone.

// The text column has a fixed width from lg and the art takes the rest, so every drawing is the same size down
// the page. Below lg the one column is minmax(0, 1fr), so nothing in a beat can widen the page.
const TEXT_FIRST = 'lg:grid-cols-[24rem_minmax(0,1fr)] xl:grid-cols-[27rem_minmax(0,1fr)]';
const ART_FIRST = 'lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem]';

export function StoryBeat({ section, index }: { section: LandingSection; index: number }) {
  const tinted = index % 2 === 1;
  const artFirst = index % 2 === 1;
  const Icon = CATEGORY_ICONS[section.id];

  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className={`scroll-mt-20 border-t border-slate-200/70 dark:border-slate-800/70 ${tinted ? 'bg-brand-50/60 dark:bg-brand-500/10' : 'bg-white dark:bg-slate-900'}`}
    >
      <div
        className={`mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-10 ${RAIL_CLEAR_PADDING} py-16 sm:py-24 lg:gap-16 ${artFirst ? ART_FIRST : TEXT_FIRST}`}
      >
        <div className={`enter-on-scroll ${artFirst ? 'lg:order-2' : ''}`}>
          {/* The section's glyph in a disc beside its plain name, above the headline. */}
          <p className={`flex items-center gap-3 ${EYEBROW}`}>
            {Icon ? (
              <GlyphDisc aria-hidden className="h-8 w-8 bg-brand-700 text-white">
                <Icon size={16} aria-hidden />
              </GlyphDisc>
            ) : null}
            {section.label}
          </p>
          <h2
            id={`${section.id}-title`}
            className="mt-4 text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl dark:text-slate-100"
          >
            {section.title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-slate-600 dark:text-slate-300">
            {section.description}
          </p>
          <ul className="mt-6 grid gap-2.5" aria-label={`${section.label} in short`}>
            {section.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 text-[15px] text-slate-700 dark:text-slate-200"
              >
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                  <CheckIcon size={11} aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>
          {/* Its own page (marketing-site.md "Feature pages"): the section broken into illustrated cards. */}
          <CtaLink href={`/features/${section.id}`} className="group mt-8">
            See Everything in {section.label}
            <ChevronRightIcon
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </CtaLink>
        </div>

        {/* The art is capped below lg so it stays a picture beside a short column of words, not a wall. */}
        <div className={`mx-auto w-full max-w-xl lg:max-w-none ${artFirst ? 'lg:order-1' : ''}`}>
          {section.art}
        </div>
      </div>
    </section>
  );
}
