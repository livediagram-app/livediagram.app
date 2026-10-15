import type { ElementTourApi } from './element-tour-api';
import {
  addRowStep,
  conceptOutro,
  inElement,
  onGraphic,
  type ConceptTourContext,
} from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';

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
  const barSelector = inElement(id, `[data-concept-row-bar][aria-label="Stage ${barAt + 1}"]`);
  const bar: TourStepOf<ElementTourApi> = {
    id: 'bar',
    title: "Each Stage's Own Bar",
    body: ctx.touch
      ? 'Every stage shows a bar while the process is selected (zoom in if the stages are small): move it left or right, or delete it. With no notes yet, it offers Add Note.'
      : 'Point at a stage for its bar: move it left or right, or delete it. With no notes yet, it offers Add Note.',
    selector: () =>
      document.querySelector(barSelector)
        ? barSelector
        : inElement(id, `[data-concept-row-zone="${barAt}"]`),
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
      `Its ${ctx.rows.length} stages each point into the next, read left to right: a pipeline, a value chain, a lifecycle.`,
      inElement(id),
    ),
    onGraphic(
      'edit',
      'Type Over a Stage',
      `${click} a stage's name to type over it. Enter keeps it, Escape puts it back.`,
      inElement(id, '[data-concept-row="0"]'),
    ),
    bar,
    ...(noted >= 0
      ? [
          onGraphic(
            'notes',
            'A Note Under Each',
            `A note sits under its stage: how long it takes, who owns it, the gate it waits on. ${click} it to change it.`,
            inElement(id, `[data-concept-note="${noted}"]`),
          ),
        ]
      : []),
    addRowStep(
      'add',
      'Add a Stage',
      'Add Stage puts a new one at the end, up to eight. The others narrow to fit.',
      'Add Stage',
    ),
    onGraphic(
      'animate',
      'Run the Pipeline',
      'Animation, then Concept: Pulse runs along the stages, as here. Build brings them in left to right.',
      inElement(id),
      'pulse',
    ),
    conceptOutro(
      'That Is a Chevron Process',
      'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
