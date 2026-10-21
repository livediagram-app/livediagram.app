// The Sankey tour (docs/specs/007-editor/element-tours.md "The Sankey tour"): an element tour of the selected diagram.
// It reads the diagram on the canvas first, lifting its widest band and a leftover as a hover would, then opens the
// Flows dialog and carries on with the dialog's own Show Me steps, so the two never drift.
import { sankeyFrame, type ShapeElement } from '@liveplanner/document';
import { balanceNotes, rowsFromFlows } from '@/lib/sankey-flow-rows';
import type { SankeyTourFocus } from '@/lib/sankey-tour-focus';
import { sankeyFlowsTourSteps, type SankeyFlowsTourContext } from './sankey-flows-tour-steps';
import { inTheMenu } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { waitForSelector } from './tour-dom';
import type { TourStepOf } from './tour-step';
import { TARGET_WAIT_MS } from './useTourEngine';
import { elementSelector } from '@/lib/canvas-selectors';

// The Sankey tour runs on the shared element tour facade.
export type SankeyElementTourApi = ElementTourApi;

type Step = TourStepOf<SankeyElementTourApi>;

// What the diagram holds when Play is pressed, which fixes the steps for the whole tour.
export type SankeyElementTourContext = {
  elementId: string;
  // The parts each canvas step lifts, as indices into the drawn layout; null leaves the step out.
  band: number | null;
  leftover: number | null;
  // The selection toolbar's More button is showing (not for a power user on a desktop, who right-clicks).
  hasMore: boolean;
  // A touch screen, which double-taps where a mouse double-clicks.
  touch: boolean;
  flows: SankeyFlowsTourContext;
};

// A step on the canvas: the dialog put away (a Back from it), the part lifted while the step is up.
function canvasStep(
  id: string,
  title: string,
  body: string,
  selector: string,
  lift?: { part: SankeyTourFocus['part']; index: number },
): Step {
  return {
    id,
    title,
    body,
    selector: () => selector,
    prepare: (api) => {
      api.closeFlows();
      if (lift) api.focus(lift.part, lift.index);
    },
    cleanup: (api) => api.clearFocus(),
  };
}

export function sankeyElementTourSteps(ctx: SankeyElementTourContext): Step[] {
  const { elementId: id } = ctx;
  const steps: Step[] = [];
  if (ctx.band !== null)
    steps.push(
      canvasStep(
        'bands',
        'Bands Carry Amounts',
        'Each band is as wide as its amount, so the biggest flows stand out.',
        elementSelector(id, `[data-sankey-band="${ctx.band}"]`),
        { part: 'band', index: ctx.band },
      ),
    );
  if (ctx.leftover !== null)
    steps.push(
      canvasStep(
        'leftover',
        'What Is Left Over',
        'Grey Leftover is what a node keeps. It is worked out for you.',
        elementSelector(id, `[data-sankey-band="${ctx.leftover}"]`),
        { part: 'band', index: ctx.leftover },
      ),
    );
  if (ctx.hasMore)
    steps.push(
      inTheMenu('style', 'Style It', 'In its menu, Sankey sets colours, labels and the unit.', [
        'Tools',
        'Sankey',
      ]),
    );
  steps.push(
    canvasStep(
      'flows',
      'Write the Flows',
      `${ctx.touch ? 'Double-tap' : 'Double-click'} it to edit its flows. Next opens them for you.`,
      elementSelector(id),
    ),
  );
  // The Flows dialog's own steps, run inside it: each opens it (again, if it was closed) and waits for it.
  for (const step of sankeyFlowsTourSteps(ctx.flows)) {
    if (step.card) continue;
    steps.push({
      ...step,
      id: `flows-${step.id}`,
      layer: 'modal',
      prepare: async (api) => {
        api.openFlows();
        await waitForSelector('[data-tour-id="sankey-preview"]', TARGET_WAIT_MS);
        await step.prepare?.(api);
      },
    });
  }
  steps.push({
    id: 'outro',
    card: 'outro',
    title: 'That Is a Sankey',
    body: 'Undo takes back any change.',
  });
  return steps;
}

// The parts the canvas steps lift, read from the diagram as it is drawn: the widest stored band, and the widest
// leftover band.
export function sankeyTourParts(
  element: ShapeElement,
): Pick<SankeyElementTourContext, 'band' | 'leftover'> {
  const frame = sankeyFrame(element);
  const { links } = frame.layout;
  let band: number | null = null;
  let leftover: number | null = null;
  links.forEach((b, i) => {
    if (frame.leftover(b)) {
      if (leftover === null || b.value > links[leftover]!.value) leftover = i;
    } else if (band === null || b.value > links[band]!.value) band = i;
  });
  return { band, leftover };
}

// What the Flows dialog will show, worked out as it does, so its steps are fixed with the rest.
export function sankeyFlowsContextOf(element: ShapeElement): SankeyFlowsTourContext {
  const rows = rowsFromFlows(element.sankeyFlows ?? []);
  return {
    hasNodes: (element.sankeyFlows ?? []).length > 0,
    hasBalanceNotes:
      balanceNotes(rows, element.sankeyUnit, element.sankeyLeftover !== 'hide').length > 0,
  };
}
