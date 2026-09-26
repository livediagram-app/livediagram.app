import { ctaHref } from '@livediagram/api-schema';
import { buttonClassName } from '@livediagram/ui';
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
    <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-600">
      {PROOF_POINTS.map((point) => (
        <li key={point} className="flex items-center gap-1.5">
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-emerald-500" aria-hidden>
            <path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px] bg-gradient-to-b from-brand-100 via-brand-50 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        {/* Says what it is and the one thing that sets it apart (docs/specs/019-marketing/marketing-site.md). */}
        <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold tracking-tight text-slate-900 sm:text-7xl">
          Diagram together, <span className="text-brand-600">live</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600 sm:text-xl">
          Sketch an idea, start from a template, or map a whole system. Share a link and your team
          builds it with you in real time.
        </p>
        {/* CTA pair (docs/specs/019-marketing/marketing-site.md): the wizard is the encouraged path, so Choose
            Template is the primary and sits on the right; Just Draw is the
            straight-to-blank-canvas escape hatch (docs/specs/007-editor/new-diagram-route.md). DOM order keeps
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
            Choose Template
          </a>
          <a
            href={ctaHref('/new?blank=1', 'Home.HeroDraw')}
            className={buttonClassName({
              variant: 'secondary',
              size: 'lg',
              className: 'w-full shadow-sm sm:order-1 sm:w-auto',
            })}
          >
            Just Draw
          </a>
        </div>
        <ProofPoints />

        <HeroIllustration />
      </div>
    </section>
  );
}
