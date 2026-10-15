import type { ElementTourApi } from './element-tour-api';
import { conceptOutro, inElement, inTheMenu, onGraphic } from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';

// The Org Chart tour (docs/specs/007-editor/element-tours.md "The Org Chart tour"), on a selected person node: its
// name, role and initials, reports and peers grown from the keyboard or the toolbar, and the tree it hangs in. It points
// at the node and its toolbar; it never grows the chart itself.

export type OrgChartTourContext = {
  elementId: string;
  hasMore: boolean;
  touch: boolean;
  // The node has reports, so dragging it carries a team.
  hasReports: boolean;
};

const toolbarButton = (label: string) =>
  `[data-testid="selection-popover"] button[aria-label="${label}"]`;

export function orgChartTourSteps(ctx: OrgChartTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  return [
    onGraphic(
      'person',
      'A Person in the Chart',
      `Each node is a person: their name, their role, and their initials in the disc. ${ctx.touch ? 'Double-tap' : 'Double-click'} to change the name.`,
      inElement(id),
    ),
    onGraphic(
      'role',
      'Their Role',
      `${click} the line under the name to write their role: Head of Engineering, Designer, On call.`,
      inElement(id, '[data-tour-part="person-role"]'),
    ),
    onGraphic(
      'initials',
      'Initials, Made for You',
      "The disc takes the first letters of the name's first two words, and follows the name as it changes.",
      inElement(id, '[data-tour-part="person-initials"]'),
    ),
    onGraphic(
      'report',
      'Add a Report',
      ctx.touch
        ? 'Add Child hangs a new person under this one, on the same trunk, ready to name.'
        : 'Tab, or Add Child here, hangs a new person under this one, on the same trunk. Just start typing their name.',
      toolbarButton('Add Child'),
    ),
    onGraphic(
      'peer',
      'Add a Peer',
      `${ctx.touch ? 'Add Sibling' : 'Enter, or Add Sibling,'} puts a new person beside this one, reporting to the same manager.`,
      toolbarButton('Add Sibling'),
    ),
    onGraphic(
      'team',
      ctx.hasReports ? 'Move a Whole Team' : 'Teams Move Together',
      `Drag a person and ${ctx.hasReports ? 'their whole team comes with them' : 'everyone under them comes too'}.`,
      inElement(id),
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'menu',
            'The Mind Map Menu',
            'An org chart is a mind map flowing down. Under Mind Map: Tidy Map lays it out again, Spacing, and Edit Outline writes the whole tree as a list.',
          ),
        ]
      : []),
    conceptOutro(
      'That Is an Org Chart',
      ctx.touch
        ? 'Every change is one undo step.'
        : 'Tab, type, Enter, type: a whole team without touching the mouse.',
    ),
  ];
}
