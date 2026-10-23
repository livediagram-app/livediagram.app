// The Popular shelf (docs/specs/008-canvas/canvas-and-palette.md "Template categories", docs/specs/007-editor/
// templates-by-mode.md "The mode filter"): where most people start, a short curated list per mode filter, each
// opening with its blank(s). Shared by the editor's template step and the marketing gallery, so the two shelves can
// never disagree.
import type { EditorMode } from '@livedocuments/document';
import { TEMPLATES, type TemplateKind } from './templates';

type PopularChoice = 'all' | EditorMode;

export const POPULAR_BY_MODE: Readonly<Record<PopularChoice, readonly TemplateKind[]>> = {
  // The blanks lead, so the picker needs no separate blank card.
  all: [
    'blank-illustration',
    'blank-slide-deck',
    'blank-article',
    'article',
    'slide-deck',
    'event-poster',
    'year-in-review',
    'social-carousel',
    'how-it-works',
    'launch-keynote',
  ],
  pages: [
    'blank-illustration',
    'article',
    'blank-slide-deck',
    'event-poster',
    'year-in-review',
    'social-carousel',
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
