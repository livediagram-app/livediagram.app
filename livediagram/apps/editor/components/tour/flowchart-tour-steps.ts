import type { ElementTourApi } from './element-tour-api';
import { conceptOutro, inTheMenu, onGraphic } from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Flowchart tour (docs/specs/007-editor/element-tours.md "The Flowchart tour"), on a selected step: growing the
// chart from the keyboard (Tab, Enter) or the step's toolbar, its type, its lane, and the Flowchart menu. It points at
// the step and its toolbar; it never grows or re-lays the chart itself.

export type FlowchartTourContext = {
  elementId: string;
  hasMore: boolean;
  touch: boolean;
  // The chart has swimlanes, so the step's toolbar carries a Lane menu.
  hasLanes: boolean;
};

const toolbarButton = (label: string) =>
  `[data-testid="selection-popover"] button[aria-label="${label}"]`;

export function flowchartTourSteps(ctx: FlowchartTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'step',
      'A Step in a Flowchart',
      'The chart lays itself out as you go, so you never line boxes up by hand.',
      elementSelector(id),
    ),
    onGraphic(
      'next',
      'The Next Step',
      ctx.touch
        ? 'Add Step adds the next step, already connected.'
        : 'Press Tab, or Add Step, for the next step. Then just type.',
      toolbarButton('Add Step'),
    ),
    onGraphic(
      'branch',
      'Add a Branch',
      `${ctx.touch ? 'Add Branch adds' : 'Press Enter, or Add Branch, for'} another path, like a decision’s No.`,
      toolbarButton('Add Branch'),
    ),
    onGraphic(
      'type',
      'Change Its Type',
      'Change the step’s type: Process, Decision, Database and more.',
      toolbarButton('Step Type'),
    ),
    ...(ctx.hasLanes
      ? [
          onGraphic(
            'lane',
            'Its Lane',
            'Pick a lane to move the step there, or drag it.',
            toolbarButton('Lane'),
          ),
        ]
      : []),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'menu',
            'The Flowchart Menu',
            `In its menu, Flowchart: ${ctx.hasLanes ? 'Add Lane for another swimlane' : 'Add Lane for swimlanes'}, Tidy Flowchart and Direction.`,
            ['Tools', 'Flowchart'],
          ),
        ]
      : []),
    conceptOutro(
      'That Is a Flowchart',
      ctx.touch
        ? 'Undo takes back any change.'
        : 'Tab, type, Enter, type: a whole process as fast as you can say it.',
    ),
  ];
}
