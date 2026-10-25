import type { ElementTourApi } from './element-tour-api';
import {
  addRowStep,
  conceptOutro,
  onGraphic,
  type ConceptTourContext,
} from './concept-element-tour-steps';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Chevrons tour (docs/specs/007-editor/element-tours.md "The Chevrons tour"): stages pointing left to right, each
// edited on the canvas from its own bar (held open by the step, as if pointed at), the notes under them, and Pulse
// running along. A chevron process has no Rows section, so there is no menu step.
export function chevronsTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  // The middle stage's bar, where both moves are on; the first on a two-stage process.
  const barAt = ctx.rows.length > 2 ? 1 : 0;
  const noted = ctx.rows.findIndex((r) => !!r.note);
  // The bar is held open by the step; a stage too small for its bar (zoomed out, or a narrow phone) draws none, so the
  // step rings the stage itself rather than waiting for a bar that never comes.
  const barSelector = elementSelector(
    id,
    `[data-concept-row-bar][aria-label="Stage ${barAt + 1}"]`,
  );
  const bar: TourStepOf<ElementTourApi> = {
    id: 'bar',
    title: "Each Stage's Own Bar",
    body: ctx.touch
      ? 'Each stage has a small bar while selected: move the stage, delete it, or add a note.'
      : 'Point at a stage for its bar: move the stage, delete it, or add a note.',
    selector: () =>
      document.querySelector(barSelector)
        ? barSelector
        : elementSelector(id, `[data-concept-row-zone="${barAt}"]`),
    prepare: async (api) => {
      api.showStageBar(barAt);
      // A frame for the bar to draw before the step looks for it.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    },
    cleanup: (api) => api.clearPreview(),
  };
  return [
    onGraphic(
      'stages',
      'Stages, Left to Right',
      `Stages read left to right, each pointing to the next.`,
      elementSelector(id),
    ),
    onGraphic(
      'edit',
      'Type Over a Stage',
      `${click} a stage's name to type over it. Enter keeps it, Escape puts it back.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    bar,
    ...(noted >= 0
      ? [
          onGraphic(
            'notes',
            'A Note Under Each',
            `A note under a stage, like who owns it. ${click} it to edit.`,
            elementSelector(id, `[data-concept-note="${noted}"]`),
          ),
        ]
      : []),
    addRowStep('add', 'Add a Stage', 'Add Stage adds one at the end, up to eight.', 'Add Stage'),
    onGraphic(
      'animate',
      'Run the Pipeline',
      'Animation › Concept brings the stages in or pulses along them.',
      elementSelector(id),
      'pulse',
    ),
    conceptOutro(
      'That Is a Chevron Process',
      'It exports as you see it. Undo takes back any change.',
    ),
  ];
}
