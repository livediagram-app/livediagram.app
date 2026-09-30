import { ctaHref } from '@livediagram/api-schema';
import { buttonClassName, ButtonContent } from '@livediagram/ui';
import { HeroConnectors } from './HeroConnectors';
import { HeroIllustration } from './HeroIllustration';
import { PROOF_POINTS } from '@/lib/proof-points';

// The proof points live on the stage's launch window now (hero-launch.tsx); the stage is
// decorative, so screen readers get them here.
function ProofPoints() {
  return (
    <ul className="sr-only">
      {PROOF_POINTS.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px] bg-gradient-to-b from-brand-100 via-brand-50 to-transparent dark:from-brand-500/20 dark:via-brand-500/5"
      />
      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        {/* An arrow from the headline to the illustration, drawn on load (HeroConnectors). */}
        <HeroConnectors />
        {/* Says what it is and the one thing that sets it apart (docs/specs/019-marketing/marketing-site.md). */}
        <h1
          data-hero-anchor="title"
          className="mx-auto max-w-3xl text-balance text-5xl font-semibold tracking-tight text-slate-900 sm:text-7xl dark:text-slate-100"
        >
          Diagram together, <span className="text-brand-600 dark:text-brand-300">live</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600 sm:text-xl dark:text-slate-300">
          Sketch an idea, start from a template, or map a whole system. Share a link and your team
          builds it with you in real time.
        </p>
        {/* CTA pair (docs/specs/019-marketing/marketing-site.md): the wizard is the encouraged path, so Choose
            Template is the primary and sits on the right; Just Draw is the
            straight-to-blank-canvas escape hatch (docs/specs/007-editor/new-document-route.md). DOM order keeps
            the primary first so the mobile stack leads with it; sm:order-*
            swaps them side by side on desktop. */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ctaHref('/new', 'Home.Hero')}
            className={buttonClassName({
              size: 'lg',
              className: 'w-full shadow-sm sm:order-2 sm:w-auto',
            })}
          >
            <ButtonContent>Choose Template</ButtonContent>
          </a>
          <a
            href={ctaHref('/new?blank=1', 'Home.HeroDraw')}
            className={buttonClassName({
              variant: 'secondary',
              size: 'lg',
              className: 'w-full shadow-sm sm:order-1 sm:w-auto',
            })}
          >
            <ButtonContent>Just Draw</ButtonContent>
          </a>
        </div>
        <ProofPoints />

        <HeroIllustration />
      </div>
    </section>
  );
}
