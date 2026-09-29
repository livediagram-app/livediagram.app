import { ctaHref } from '@livediagram/api-schema';
import { buttonClassName, Glyph, ButtonContent } from '@livediagram/ui';
import { HeroIllustration } from './HeroIllustration';

// Each one true today (docs/specs/019-marketing/marketing-site.md's golden rule): no paid tier, the canvas works
// signed out, edits land live, and the repo is MIT.
const PROOF_POINTS = [
  'Free for everyone',
  'No sign-up',
  'Real-time collaboration',
  'Open source (MIT)',
];

function ProofPoints() {
  return (
    <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
      {PROOF_POINTS.map((point) => (
        <li key={point} className="flex items-center gap-1.5">
          <Glyph size={16} units={16} className="h-4 w-4 text-emerald-500">
            <path d="M3.5 8.5l3 3 6-7" />
          </Glyph>
          {point}
        </li>
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
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        {/* Says what it is and the one thing that sets it apart (docs/specs/019-marketing/marketing-site.md). */}
        <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold tracking-tight text-slate-900 sm:text-7xl dark:text-slate-100">
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
