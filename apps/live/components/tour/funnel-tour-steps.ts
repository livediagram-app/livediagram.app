import type { ElementTourApi } from './element-tour-api';
import {
  addRowStep,
  conceptOutro,
  inElement,
  inTheMenu,
  onGraphic,
  type ConceptTourContext,
} from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';

// The Funnel tour (docs/specs/007-editor/element-tours.md "The Funnel tour"): a Pyramid in its Funnel variant, its
// stages narrowing down, the number each band carries, and Build from the top.
export function funnelTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  const valued = ctx.rows.findIndex((r) => !!r.note);
  const last = ctx.rows.length - 1;
  return [
    onGraphic(
      'stages',
      'Narrowing Stage by Stage',
      'Each band is a stage, the widest first. They narrow to a third of the width at the bottom, so the drop-off reads at a glance.',
      inElement(id),
    ),
    onGraphic(
      'edit',
      'Type Over a Stage',
      `${click} a stage's name to type over it. Enter keeps it, Escape puts it back.`,
      inElement(id, '[data-concept-row="0"]'),
    ),
    ...(valued >= 0
      ? [
          onGraphic(
            'values',
            'A Number on Each Band',
            `Each band can carry its number beside its name: visits, sign-ups, sales. ${click} it to change it; clear it and the name takes the whole band.`,
            inElement(id, `[data-concept-note="${valued}"]`),
          ),
        ]
      : []),
    addRowStep(
      'add',
      'Add a Stage',
      'Add Tier puts a new band at the bottom, up to six. The funnel narrows again to fit.',
      'Add Tier',
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'shape',
            'Funnel, Pyramid or Inverted',
            'In the menu, Shape switches between Funnel, Pyramid and Inverted, keeping every band; Rows reorders them.',
          ),
        ]
      : []),
    onGraphic(
      'colours',
      'From the Accent Down',
      'The widest band takes the accent and each one below steps toward the fill, its words kept readable.',
      inElement(id, `[data-concept-row="${Math.max(0, last)}"]`),
    ),
    onGraphic(
      'animate',
      'Pour It In',
      'Animation, then Concept: Build brings the bands in from the top down, as here. Pulse lights each in turn.',
      inElement(id),
      'build',
    ),
    conceptOutro(
      'That Is a Funnel',
      'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
