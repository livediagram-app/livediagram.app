// The Popular shelf (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): where most people start, a
// short curated list opening with the blanks, for the marketing gallery. (The editor's start once had a Recommended
// group drawn from a shorter list; retired 2026-11-04, docs/specs/007-editor/start-diagramming.md "Groups".)
import type { TemplateKind } from './templates';

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
