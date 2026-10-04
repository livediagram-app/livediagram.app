import { HeroConnectors } from './HeroConnectors';
import { HeroIllustration } from './HeroIllustration';
import { HeroTitleLine } from './HeroTitleLine';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px] bg-gradient-to-b from-brand-100 via-brand-50 to-transparent dark:from-brand-500/20 dark:via-brand-500/5"
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-24 sm:px-6 pb-20 text-center sm:pt-32 sm:pb-28">
        {/* An arrow from the headline to the illustration, drawn on load (HeroConnectors). */}
        <HeroConnectors />
        {/* Says what it is and the one thing that sets it apart (docs/specs/019-marketing/marketing-site.md). */}
        {/* Lifted above the stage below it, so the word card opens over the windows. */}
        <h1 className="relative z-20 mx-auto whitespace-nowrap text-[clamp(1.5rem,9.4vw,4.5rem)] font-semibold sm:text-[clamp(1.5rem,8.2vw,4.5rem)] leading-tight tracking-tight text-slate-900 dark:text-slate-100">
          {/* The rotating first word (HeroTitleLine) is decorative: the stable headline is what
              screen readers and crawlers read. One line from `sm`, the size scaling with the viewport
              so the longest word still fits; on a phone "live." takes a second line, so the words
              can be larger. */}
          <span className="sr-only">Diagram together, live.</span>
          <span aria-hidden>
            <HeroTitleLine>
              {' '}
              together,
              <span className="max-sm:hidden">
                {' '}
                <span className="text-brand-600 dark:text-brand-300">live</span>.
              </span>
            </HeroTitleLine>
          </span>
          <span aria-hidden className="block sm:hidden">
            <span className="text-brand-600 dark:text-brand-300">live</span>.
          </span>
        </h1>
        <p
          data-hero-anchor="lead"
          className="mx-auto mt-6 max-w-3xl text-pretty text-lg leading-relaxed text-slate-600 sm:text-xl dark:text-slate-300"
        >
          Make whatever&rsquo;s on your mind, from diagrams and whiteboards to illustrations and
          documents. Share a link and your team builds it with you in real time.
        </p>

        <HeroIllustration />
      </div>
    </section>
  );
}
