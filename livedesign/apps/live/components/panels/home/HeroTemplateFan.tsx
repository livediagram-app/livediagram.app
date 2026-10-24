'use client';

// The art on the right of Explorer Home's hero (docs/specs/013-workspace/explorer-home.md "The hero"): three template
// previews fanned, a logo in front and two wireframes behind, so the hero shows what can be made. The shared Explorer
// (@liveworkspace/explorer) draws the hero and takes this as its `heroArt`; it loads only with the hero.

import type { HeroSheet } from '@liveworkspace/explorer';
import type { TemplateKind } from '@livedesign/templates';
import { TemplatePicture } from '@/components/start/template-card';
import { templateOf } from '@/components/start/start-template-items';

/** The three previews fanned in the hero, the front one first. */
export const HERO_FAN: readonly TemplateKind[] = [
  'logo-design',
  'wireframe-mobile-app',
  'wireframe-website',
];

// One sheet: a white-edged card.
const SHEET_FRAME =
  'absolute overflow-hidden rounded-2xl border-[6px] border-white bg-white dark:border-slate-800 dark:bg-slate-800';

/** The three places, the front sheet first, then back left and back right. */
const SHEET_PLACES = [
  'left-[20%] top-20 z-10 h-44 w-[62%] shadow-[0_24px_50px_-18px_rgba(225,29,72,0.5)]',
  'left-[6%] top-12 h-40 w-[58%] -rotate-[8deg] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.35)]',
  'right-[2%] top-8 h-40 w-[58%] rotate-[7deg] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.35)]',
] as const;

export function HeroTemplateFan() {
  return (
    <div aria-hidden className="relative h-72 w-full">
      {HERO_FAN.map((kind, i) => (
        <span key={kind} data-hero-sheet={kind} className={`${SHEET_FRAME} ${SHEET_PLACES[i]}`}>
          <TemplatePicture kind={kind} />
        </span>
      ))}
    </div>
  );
}

// The same previews as the sheets the shared Explorer fans (@liveworkspace/explorer HeroSheets), for the hero
// manifest liveworkspace.app draws (hero-manifest.test.tsx): the backs first, the front sheet last. A template
// preview is light-canvas art in both looks.
export const HERO_TEMPLATES_LABEL = 'What a design can be';

export function heroSheets(): HeroSheet[] {
  return [HERO_FAN[1]!, HERO_FAN[2]!, HERO_FAN[0]!].map((kind) => ({
    id: kind,
    label: templateOf(kind).title,
    light: <TemplatePicture kind={kind} />,
    dark: <TemplatePicture kind={kind} />,
  }));
}
