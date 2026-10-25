import { HeroConnectors } from './HeroConnectors';
import { HeroFan } from './HeroFan';
import { HeroSearch } from './HeroSearch';
import { HeroWhiteboard } from './HeroWhiteboard';

// The landing page's hero (docs/specs/019-marketing/marketing-site.md "Hero"), intent-led: it asks
// what the visitor is making and takes them straight to a starting point, so it grows with the product
// instead of naming one mode. A band in the brand mark's colours (@livediagram/ui hero-band.css, shared with the help centre),
// drawn here as a whiteboard wall (app/hero-whiteboard.css): the promise badge, the question, the template search,
// then the fan along its foot: templates taped up and dealt every few seconds, for every visitor.
const BADGE =
  'inline-flex items-center gap-2 rounded-full border border-(--hero-chip-border) bg-(--hero-chip-bg) px-3.5 py-1.5 text-sm font-medium text-(--hero-chip-text)';

export function Hero() {
  return (
    // On a wide screen its height is its content's, with room to breathe; on a phone it fills the
    // screen under the header, the fan along its foot.
    <section className="hero-band hero-whiteboard relative bg-(--hero-bg) text-(--hero-ink) max-sm:flex max-sm:min-h-[calc(100svh-72px)] max-sm:flex-col">
      <HeroWhiteboard />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 max-sm:flex-1 max-sm:justify-center pt-16 text-center sm:px-6 sm:pt-36 lg:pt-44">
        {/* An arrow drawn on load from the end of the question down onto the search. */}
        <HeroConnectors />
        {/* Two promises, each its own badge and each true today (free, MIT, no account needed). A
            phone keeps the first only, so the row stays one line. */}
        <ul aria-label="Our promises" className="flex justify-center gap-2.5">
          <li className={BADGE}>
            <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
            Free and open source
          </li>
          <li className={`${BADGE} max-sm:hidden`}>
            <span aria-hidden className="h-2 w-2 rounded-full bg-sky-500" />
            No sign-up to start
          </li>
        </ul>
        <h1
          data-hero-anchor="title"
          className="mx-auto mt-7 max-w-4xl text-balance text-[clamp(2.5rem,7vw,5rem)] font-semibold leading-[1.02] tracking-tight"
        >
          What are you making today?
        </h1>
        <p
          data-hero-anchor="lead"
          className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-(--hero-muted) sm:text-xl"
        >
          Pick a starting point and release what&rsquo;s inside your mind. Diagram, sketch, run a
          session or publish, then share one link and build it together.
        </p>
        <HeroSearch />
      </div>
      <HeroFan />
    </section>
  );
}
