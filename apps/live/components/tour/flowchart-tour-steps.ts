import type { ElementTourApi } from './element-tour-api';
import { conceptOutro, inElement, inTheMenu, onGraphic } from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';

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
      'Each step belongs to its chart, and every change lays the chart out again, so nobody ever drags a box into line.',
      inElement(id),
    ),
    onGraphic(
      'next',
      'The Next Step',
      ctx.touch
        ? 'Add Step adds the next step after this one, joined by an arrow, ready to type into.'
        : 'Tab, or Add Step here, adds the next step after this one, joined by an arrow. Just start typing to name it.',
      toolbarButton('Add Step'),
    ),
    onGraphic(
      'branch',
      'Add a Branch',
      `${ctx.touch ? 'Add Branch' : 'Enter, or Add Branch,'} adds a step beside this one, from the step it came from: a decision's other way out.`,
      toolbarButton('Add Branch'),
    ),
    onGraphic(
      'type',
      'Change Its Type',
      'Process, Decision, Input / Output, Document, Database and more: the type is the shape. The step keeps its words and the chart lays itself out again.',
      toolbarButton('Step Type'),
    ),
    ...(ctx.hasLanes
      ? [
          onGraphic(
            'lane',
            'Its Lane',
            'Pick another lane to move the step there, or drag it across. The lanes grow to fit.',
            toolbarButton('Lane'),
          ),
        ]
      : []),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'menu',
            'The Flowchart Menu',
            `Under Flowchart: ${ctx.hasLanes ? 'Add Lane for another swimlane' : 'Add Lane for swimlanes'}, Tidy Flowchart, and the Direction it flows in, down or right.`,
          ),
        ]
      : []),
    conceptOutro(
      'That Is a Flowchart',
      ctx.touch
        ? 'Every change is one undo step.'
        : 'Tab, type, Enter, type: a whole process as fast as it is spoken.',
    ),
  ];
}
