// The Popular shelf (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): where most people start, a
// short curated list opening with the blanks. Shared by the editor's template step and the marketing gallery, so the
// two shelves can never disagree.
import { TEMPLATES, type TemplateKind } from './templates';

// The gallery's shelf. The blanks lead, so the picker needs no separate blank card.
export const POPULAR_TEMPLATE_KINDS: readonly TemplateKind[] = [
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
];

// The editor's template step: a shorter list, Blank Illustration first.
const STEP_POPULAR: readonly TemplateKind[] = [
  'blank-illustration',
  'article',
  'blank-slide-deck',
  'event-poster',
  'year-in-review',
  'social-carousel',
];

const LISTED = new Set(TEMPLATES.filter((t) => !t.hidden).map((t) => t.kind));

/** The template step's Popular: its curated list, hidden templates left out. */
export function stepPopularKinds(): TemplateKind[] {
  return STEP_POPULAR.filter((k) => LISTED.has(k));
}
