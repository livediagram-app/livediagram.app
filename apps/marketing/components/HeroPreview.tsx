'use client';

import { Activity, type CSSProperties, type ReactNode } from 'react';
import { ctaHref } from '@livediagram/api-schema';
import { ButtonContent } from '@livediagram/ui';
import { activeEnv } from '@/lib/hero-preview-stage';
import { HERO_CTA_CLASS, HERO_CTAS } from './hero-ctas';
import { HeroEnvironment } from './hero-environments';
import { useHeroPreview } from './useHeroPreview';

// The hero section with its environment preview (docs/specs/019-marketing/hero-environment-preview.md):
// the stage rides on `data-hero-stage`, and hero-preview.css does every fade and cascade from it,
// so React only says which stage and which environment. The environments sit in <Activity>: hidden
// (rendered at low priority, kept alive) until the buttons are first approached, then visible at
// opacity 0, so the first preview crossfades instead of popping.
export function HeroPreview({
  backdrop,
  copy,
  after,
}: {
  backdrop: ReactNode;
  copy: ReactNode;
  after: ReactNode;
}) {
  const { stage, warm, groupProps, ctaProps } = useHeroPreview();
  const showing = activeEnv(stage);

  return (
    <section data-hero-stage={stage.kind} className="relative overflow-hidden">
      {backdrop}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {HERO_CTAS.map(({ env }) => (
          <Activity key={env} mode={warm ? 'visible' : 'hidden'}>
            <div className="hero-env" data-active={showing === env}>
              <HeroEnvironment env={env} />
            </div>
          </Activity>
        ))}
        <div className="hero-scrim" />
      </div>
      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <div className="hero-copy">{copy}</div>
        {/* Three ways in (docs/specs/019-marketing/marketing-site.md "Hero"), one equal set in the
            order people reach for them. Each previews where it leads while pointed at or focused. */}
        <div
          role="group"
          aria-label="Ways to start"
          className="hero-ctas mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-nowrap"
          {...groupProps}
        >
          {HERO_CTAS.map(({ label, href, source, env, Icon }, i) => (
            <a
              key={label}
              href={ctaHref(href, source)}
              className={HERO_CTA_CLASS}
              style={{ '--i': i } as CSSProperties}
              {...ctaProps(env, ctaHref(href, source))}
            >
              <Icon size={18} className="shrink-0 text-brand-600 dark:text-brand-300" />
              <ButtonContent>{label}</ButtonContent>
            </a>
          ))}
        </div>
        <div className="hero-after">{after}</div>
      </div>
    </section>
  );
}
