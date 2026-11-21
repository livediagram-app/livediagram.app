'use client';

// The frame of a template tile's picture (liveplanner/docs/specs/026-plan/automations.md "The Automations screen":
// Templates): the wash and the dot grid in the template's colour, with the app's own scene drawn on it (its parts
// are scene-parts.tsx, moved by the app's scenes stylesheet). Decoration only: aria-hidden.

import type { ReactNode } from 'react';
import { TONES, type SceneTone, type ToneClasses } from './scene-parts';

export type { SceneTone } from './scene-parts';

/** The scene at the top of a template tile, in the template's colour. */
export function TemplateScene({
  tone,
  Scene,
}: {
  tone: SceneTone;
  Scene: (p: { tone: ToneClasses }) => ReactNode;
}) {
  const t = TONES[tone];
  return (
    <span
      aria-hidden
      className={`relative flex h-[116px] shrink-0 gap-2 overflow-hidden border-b border-slate-100 bg-gradient-to-br p-3 dark:border-slate-800 ${t.wash}`}
    >
      <span
        className={`pointer-events-none absolute inset-0 ${t.dots}`}
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.2px)',
          backgroundSize: '10px 10px',
          maskImage: 'linear-gradient(115deg, transparent 20%, #000 95%)',
          WebkitMaskImage: 'linear-gradient(115deg, transparent 20%, #000 95%)',
        }}
      />
      <Scene tone={t} />
    </span>
  );
}
