import type { ElementTourApi } from './element-tour-api';
import {
  addRowStep,
  conceptOutro,
  inTheMenu,
  onGraphic,
  type ConceptTourContext,
} from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Onion tour (docs/specs/007-editor/element-tours.md "The Onion tour"): rings nested round one core, never
// overlapping, the core first and the rest outward, and Pulse rippling out from the middle.
export function onionTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  const outer = Math.max(0, ctx.rows.length - 1);
  return [
    onGraphic(
      'rings',
      'Nested, Not Overlapping',
      `Its ${ctx.rows.length} rings nest round one core, each wrapping everything inside it. It is not a Venn: nothing overlaps.`,
      elementSelector(id),
    ),
    onGraphic(
      'core',
      'The Core',
      `The first row is the core, in the middle and solid in the accent: the domain, the thing it all protects. ${click} its name to type over it.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    onGraphic(
      'outer',
      'Outward From There',
      'Each ring after it sits further out, its name along the top of its band, its colour stepping toward the fill.',
      elementSelector(id, `[data-concept-row="${outer}"]`),
    ),
    addRowStep(
      'add',
      'Add a Ring',
      'Add Ring puts a new ring round the outside, up to six. The others draw in to fit.',
      'Add Ring',
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'rows',
            'Reorder in the Menu',
            'Under Tools, Rows lists every ring from the core out: rename one, move it in or out, or remove it (two stay).',
          ),
        ]
      : []),
    onGraphic(
      'animate',
      'Ripple Outward',
      'Animation, then Concept: Pulse ripples from the core outward, as here. Build grows it ring by ring.',
      elementSelector(id),
      'pulse',
    ),
    conceptOutro(
      'That Is an Onion',
      'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
