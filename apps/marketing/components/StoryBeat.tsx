import { CheckIcon, ChevronRightIcon, GlyphDisc } from '@livediagram/ui';
import { CATEGORY_ICONS } from '@/components/category-icons';
import { CtaLink } from '@/components/CtaLink';
import { FeatureScene } from '@/components/FeatureScene';
import { featureHref } from '@/lib/feature-anchor';
import { sectionHighlights, type LandingSection } from '@/lib/landing-content';

// One beat of the landing page's story (docs/specs/019-marketing/marketing-site.md "Story beats"):
// one core feature of the app. Its number and plain name above the headline, its pitch, a few
// highlights (each a link to its card on the category page), a link into the category page, and
// that feature's hero scene playing beside it. Alternates the scene's side and the tinted
// background by index so the run reads as a composed page.

// The text column has a fixed width and the scene takes the rest, so the scene is drawn about the
// size the hero draws it (its small text was soft at the narrower width) and starts on a whole
// pixel, where a fraction of the row (5fr / 7fr) landed it between pixels.
const TEXT_FIRST = 'lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]';
const SCENE_FIRST = 'lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]';

export function StoryBeat({ section, index }: { section: LandingSection; index: number }) {
  const tinted = index % 2 === 1;
  const artFirst = index % 2 === 1;
  const number = String(index + 1).padStart(2, '0');
  const Icon = CATEGORY_ICONS[section.id];

  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className={`scroll-mt-20 border-t border-slate-200/70 dark:border-slate-800/70 ${tinted ? 'bg-brand-50/60 dark:bg-brand-500/10' : 'bg-white dark:bg-slate-900'}`}
    >
      <div
        className={`mx-auto grid max-w-7xl items-center gap-10 px-6 py-20 sm:py-24 lg:gap-14 ${artFirst ? SCENE_FIRST : TEXT_FIRST}`}
      >
        {/* Centred while the beat is one column (a phone or tablet, the scene hidden), left-aligned
            beside the scene from lg. */}
        <div className={`enter-on-scroll text-center lg:text-left ${artFirst ? 'lg:order-2' : ''}`}>
          {/* The beat's number beside the feature's plain name, above the headline. */}
          <p className="flex items-center justify-center gap-3 text-sm lg:justify-start font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-300">
            <GlyphDisc
              aria-hidden
              className="h-8 w-8 bg-brand-700 text-xs font-semibold text-white tabular-nums"
            >
              {number}
            </GlyphDisc>
            {Icon ? <Icon size={16} aria-hidden /> : null}
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

          {/* A few of the features waiting on its page, each straight to its card. Centred as a block
              while the beat is centred, its ticks still lined up on the left. */}
          <ul
            className="mx-auto mt-6 grid w-fit gap-x-6 gap-y-2.5 text-left sm:grid-cols-2 lg:mx-0 lg:grid-cols-1"
            aria-label={`${section.label} highlights`}
          >
            {sectionHighlights(section).map((item) => (
              <li key={item.title}>
                <a
                  href={featureHref(section.id, item.title)}
                  className="group flex items-start gap-2 rounded-sm text-[15px] text-slate-700 transition hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-slate-200 dark:hover:text-brand-200"
                >
                  <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                    <CheckIcon size={11} aria-hidden />
                  </span>
                  {item.title}
                </a>
              </li>
            ))}
          </ul>

          <CtaLink href={`/features/${section.id}`} className="group mt-8">
            {section.cta}
            <ChevronRightIcon
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </CtaLink>
        </div>

        {/* Hidden below the two-column breakpoint: stacked on mobile it eats
            the screen and restates the pitch above it. */}
        {/* No scroll-in slide here: the scene plays its own build as it arrives, and a transform
            mid-entry kept the window on its own layer, painted off the pixel grid and blurred. */}
        <div className={`hidden lg:block ${artFirst ? 'lg:order-1' : ''}`}>
          <FeatureScene scene={section.scene} />
        </div>
      </div>
    </section>
  );
}
