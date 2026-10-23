// The Popular shelf (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): where most people start, a short curated list per mode filter, each
// opening with its blank(s). Shared by the editor's template step and the marketing gallery, so the two shelves can
// never disagree.
import type { EditorMode } from '@livedesign/design';
import { TEMPLATES, type TemplateKind } from './templates';

type PopularChoice = 'all' | EditorMode;

export const POPULAR_BY_MODE: Readonly<Record<PopularChoice, readonly TemplateKind[]>> = {
  // The blanks lead, so the picker needs no separate blank card.
  // Pages is the only mode, so Everything and Pages share one shelf.
  all: [
    'blank-illustration',
    'logo-design',
    'wireframe-mobile-app',
    'wireframe-website',
    'wireframe-dashboard',
  ],
  pages: [
    'blank-illustration',
    'logo-design',
    'wireframe-mobile-app',
    'wireframe-website',
    'wireframe-dashboard',
  ],
};

// Popular under Everything (the marketing gallery's and the step's default shelf).
export const POPULAR_TEMPLATE_KINDS: readonly TemplateKind[] = POPULAR_BY_MODE.all;

// The fewest cards any mode's Popular holds (popular.test.ts pins every list to it).
export const POPULAR_PER_MODE = 5;

const LISTED = new Set(TEMPLATES.filter((t) => !t.hidden).map((t) => t.kind));

/** Popular for a mode filter: its curated list, hidden templates left out. */
export function popularKindsFor(choice: PopularChoice): TemplateKind[] {
  return POPULAR_BY_MODE[choice].filter((k) => LISTED.has(k));
}
