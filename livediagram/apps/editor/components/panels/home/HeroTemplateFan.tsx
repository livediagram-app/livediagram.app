'use client';

// Home's hero art (docs/specs/013-workspace/explorer-home.md): three template previews fanned as sheets, so a person
// sees what livediagram makes. Loaded lazily with Home's hero in the workspace frame's Explorer
// (app/embed/workbench/ExplorerHost.tsx), with the previews it draws.

import type { TemplateKind } from '@livediagram/templates';
import { TemplatePicture } from '@/components/start/template-card';

/** The three previews fanned in the hero, the front one first. */
export const HERO_FAN: readonly TemplateKind[] = ['flowchart', 'mindmap', 'retrospective'];

// One sheet: a white-edged card.
const SHEET_FRAME =
  'absolute overflow-hidden rounded-2xl border-[6px] border-white bg-white dark:border-slate-800 dark:bg-slate-800';

/** The three places, the front sheet first, then back left and back right. */
const SHEET_PLACES = [
  'left-[20%] top-20 z-10 h-44 w-[62%] shadow-[0_24px_50px_-18px_rgba(2,132,199,0.5)]',
  'left-[6%] top-12 h-40 w-[58%] -rotate-[8deg] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.35)]',
  'right-[2%] top-8 h-40 w-[58%] rotate-[7deg] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.35)]',
] as const;

export function HeroTemplateFan() {
  return (
    <>
      {HERO_FAN.map((kind, i) => (
        <span key={kind} data-hero-sheet={kind} className={`${SHEET_FRAME} ${SHEET_PLACES[i]}`}>
          <TemplatePicture kind={kind} />
        </span>
      ))}
    </>
  );
}

export default HeroTemplateFan;
