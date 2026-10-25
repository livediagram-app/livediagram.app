import { HeroBoard } from './HeroBoard';
import { HeroConnectors } from './HeroConnectors';
import { HeroFan } from './HeroFan';
import { HeroSearch } from './HeroSearch';

// The landing page's hero (docs/specs/019-marketing/marketing-site.md "Hero"), intent-led: it asks
// what the visitor is making and takes them straight to a starting point, so it grows with the product
// instead of naming one kind of page. A band in the brand mark's colours (@livedesign/ui hero-band.css, shared with the help centre): the promise
// badge, the question, the template search, then a fan along its foot:
// templates dealt every few seconds, for every visitor. From `xl` it is a moodboard instead: plain blush, the
// copy on a clean card in the middle and a collage of templates round it (HeroBoard), the fan, dots and arrow hidden.
const BADGE =
  'inline-flex items-center gap-2 rounded-full border border-(--hero-chip-border) bg-(--hero-chip-bg) px-3.5 py-1.5 text-sm font-medium text-(--hero-chip-text)';

export function Hero() {
  return (
    // On a wide screen its height is its content's, with room to breathe; on a phone it fills the
    // screen under the header, the fan along its foot.
    <section className="hero-band relative bg-(--hero-bg) text-(--hero-ink) max-sm:flex max-sm:min-h-[calc(100svh-72px)] max-sm:flex-col xl:min-h-[47.5rem] xl:bg-[#fdeef0] xl:dark:bg-[#0c0507]">
      <div aria-hidden className="hero-band-dots pointer-events-none absolute inset-0 xl:hidden" />
      {/* From `xl` this row spans the collage's cards, so only the card in it takes the pointer. */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col 2xl:max-w-7xl px-4 max-sm:flex-1 max-sm:justify-center pt-16 text-center sm:px-6 sm:pt-36 lg:pt-44 xl:pointer-events-none xl:pt-[7.5rem] xl:pb-[6.25rem]">
        {/* The card from `xl`; plain below. */}
        <div className="relative flex flex-col xl:pointer-events-auto xl:mx-auto xl:min-h-[33.75rem] xl:w-full xl:max-w-[42.5rem] 2xl:max-w-[50rem] xl:justify-center xl:rounded-[1.75rem] xl:border xl:border-rose-100 xl:bg-white/95 xl:px-[3.75rem] xl:py-10 xl:shadow-[0_30px_60px_-30px_var(--hero-card-shadow)] xl:dark:border-slate-800 xl:dark:bg-slate-900/95">
          {/* An arrow drawn on load from the end of the question down onto the search; the card has no room for it. */}
          <HeroConnectors wide={false} />
          {/* Two promises, each its own badge and each true today (free, MIT, no account needed). A
            phone keeps the first only, so the row stays one line. */}
          <ul aria-label="Our promises" className="flex justify-center gap-2.5">
            <li className={BADGE}>
              <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
              Free and open source
            </li>
            <li className={`${BADGE} max-sm:hidden`}>
              <span aria-hidden className="h-2 w-2 rounded-full bg-rose-500" />
              No sign-up to start
            </li>
          </ul>
          <h1
            data-hero-anchor="title"
            className="mx-auto mt-7 max-w-4xl text-balance text-[clamp(2.5rem,7vw,5rem)] font-semibold xl:text-[4.25rem] 2xl:text-[4.75rem] leading-[1.02] tracking-tight"
          >
            What are you designing today?
          </h1>
          <p
            data-hero-anchor="lead"
            className="mx-auto mt-6 max-w-2xl text-pretty xl:max-w-[35rem] 2xl:max-w-[40rem] text-lg leading-relaxed text-(--hero-muted) sm:text-xl"
          >
            Pick a starting point and make it on pages. Design a logo, wireframe an app or a
            website, or edit a photo in layers, then share one link and finish it together.
          </p>
          <HeroSearch />
        </div>
      </div>
      {/* The fan below `xl`; hidden, it never swaps (it holds off screen). */}
      <div className="xl:hidden">
        <HeroFan />
      </div>
      {/* Last in the tree, so its shuffle runs after the fan's; it sits behind the copy (z-10). */}
      <HeroBoard />
    </section>
  );
}
