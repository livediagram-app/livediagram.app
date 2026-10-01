import { HeroConnectors } from './HeroConnectors';
import { HeroIllustration } from './HeroIllustration';
import { HeroPreview } from './HeroPreview';
import { HeroTitleLine } from './HeroTitleLine';
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

// The headline, lead and stage stay server-rendered; HeroPreview is the client boundary that
// previews each way to start behind them (docs/specs/019-marketing/hero-environment-preview.md).
export function Hero() {
  return (
    <HeroPreview
      backdrop={
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px] bg-gradient-to-b from-brand-100 via-brand-50 to-transparent dark:from-brand-500/20 dark:via-brand-500/5"
        />
      }
      copy={
        <>
          {/* An arrow from the headline to the illustration, drawn on load (HeroConnectors). */}
          <HeroConnectors />
          {/* Says what it is and the one thing that sets it apart (docs/specs/019-marketing/marketing-site.md). */}
          <h1 className="mx-auto whitespace-nowrap text-[clamp(1.5rem,7.6vw,4.5rem)] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            {/* The rotating first word (HeroTitleLine) is decorative: the stable headline is what
                screen readers and crawlers read. One line at every width: the size scales with the
                viewport so the longest word still fits. */}
            <span className="sr-only">Diagram together, live.</span>
            <span aria-hidden>
              <HeroTitleLine>
                {' '}
                together, <span className="text-brand-600 dark:text-brand-300">live</span>.
              </HeroTitleLine>
            </span>
          </h1>
          <p
            data-hero-anchor="lead"
            className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600 sm:text-xl dark:text-slate-300"
          >
            Sketch an idea, start from a template, or map a whole system. Share a link and your team
            builds it with you in real time.
          </p>
        </>
      }
      after={
        <>
          <ProofPoints />
          <HeroIllustration />
        </>
      }
    />
  );
}
