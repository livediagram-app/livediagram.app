import type { ReactNode } from 'react';

// The header band every help page opens on (docs/specs/018-help/help-pages.md "Shared look"): the marketing
// hero's band (`hero-band` in @livedocuments/ui), the canvas's dot grid fading out towards its foot, a display
// title in the band's ink, and optionally a category scene on the right from `lg` up. The home page passes
// `home` for the centred, display-size version.
export function HelpHero({
  eyebrow,
  title,
  lede,
  art,
  home = false,
  children,
}: {
  /** The small uppercase label above the title: plain text, or a link back to the category. */
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** A category scene, shown framed beside the copy on a wide screen. */
  art?: ReactNode;
  home?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="hero-band relative border-b border-slate-200 bg-(--hero-bg) dark:border-slate-800">
      <div aria-hidden className="hero-band-dots pointer-events-none absolute inset-0" />
      <div
        className={`relative mx-auto max-w-7xl px-4 md:px-8 ${
          home ? 'py-14 text-center md:py-20' : 'py-10 md:py-14'
        } ${art ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-14' : ''}`}
      >
        <div className={home ? 'mx-auto max-w-3xl' : 'max-w-3xl'}>
          {eyebrow && (
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
              {eyebrow}
            </div>
          )}
          <h1
            className={`font-bold tracking-tight text-(--hero-ink) ${
              home
                ? 'text-4xl sm:text-5xl md:text-6xl'
                : 'text-3xl md:text-[2.75rem] md:leading-tight'
            }`}
          >
            {title}
          </h1>
          {lede && (
            <p
              className={`mt-4 leading-relaxed text-(--hero-muted) ${
                home ? 'mx-auto max-w-2xl text-base md:text-lg' : 'max-w-2xl text-base md:text-lg'
              }`}
            >
              {lede}
            </p>
          )}
          {children}
        </div>
        {art && (
          <div
            aria-hidden
            className="mt-0 hidden aspect-[400/220] overflow-hidden rounded-2xl border border-slate-200 shadow-[0_18px_40px_-24px_var(--hero-card-shadow)] lg:block dark:border-slate-800"
          >
            {art}
          </div>
        )}
      </div>
    </section>
  );
}
