import { ctaHref, type CtaSource } from '@livediagram/api-schema';
import { templateBrowseHref, templateCreateHref } from '@livediagram/templates';
import {
  buttonClassName,
  ButtonContent,
  FlowchartIcon,
  MarkerIcon,
  MindmapIcon,
  type IconProps,
} from '@livediagram/ui';
import type { ComponentType } from 'react';
import { HeroConnectors } from './HeroConnectors';
import { HeroIllustration } from './HeroIllustration';
import { HeroTitleLine } from './HeroTitleLine';
import { PROOF_POINTS } from '@/lib/proof-points';

// The hero's three ways to start, each with its icon and its landing-funnel source
// (docs/specs/019-marketing/landing-funnel.md).
export const HERO_CTAS: readonly {
  label: string;
  href: string;
  source: CtaSource;
  Icon: ComponentType<IconProps>;
}[] = [
  {
    label: 'Drawing',
    href: templateCreateHref('whiteboard'),
    source: 'Home.HeroDraw',
    Icon: MarkerIcon,
  },
  { label: 'Diagram', href: '/new', source: 'Home.Hero', Icon: FlowchartIcon },
  {
    label: 'Brainstorm',
    href: templateBrowseHref('brainstorm'),
    source: 'Home.HeroBrainstorm',
    Icon: MindmapIcon,
  },
];

// One class for all three: the secondary style (none filled), one height from the size, one width
// from sm up, so they read as peers and the row holds still.
const HERO_CTA_CLASS = buttonClassName({
  variant: 'secondary',
  size: 'lg',
  className: 'w-full shadow-sm sm:w-44',
});

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
        {/* Three ways in (docs/specs/019-marketing/marketing-site.md "Hero"), one equal set in the
            order people reach for them: Drawing lands straight on a whiteboard with a pen in hand,
            Diagram is the wizard and its whole catalogue, Brainstorm opens the wizard on the
            brainstorming formats. Peers, so one style, one size and an icon each; one row that
            never wraps from sm up, stacked in the same order on mobile. */}
        <div
          role="group"
          aria-label="Ways to start"
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-nowrap"
        >
          {HERO_CTAS.map(({ label, href, source, Icon }) => (
            <a key={label} href={ctaHref(href, source)} className={HERO_CTA_CLASS}>
              <Icon size={18} className="shrink-0 text-brand-600 dark:text-brand-300" />
              <ButtonContent>{label}</ButtonContent>
            </a>
          ))}
        </div>
        <ProofPoints />

        <HeroIllustration />
      </div>
    </section>
  );
}
