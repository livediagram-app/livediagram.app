import type { ElementTourApi } from './element-tour-api';
import { conceptOutro, inTheMenu, onGraphic } from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

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
      `Each box is a person. ${ctx.touch ? 'Double-tap' : 'Double-click'} to change their name.`,
      elementSelector(id),
    ),
    onGraphic(
      'role',
      'Their Role',
      `${click} under the name to add their role.`,
      elementSelector(id, '[data-tour-part="person-role"]'),
    ),
    onGraphic(
      'initials',
      'Initials, Made for You',
      "The disc takes the first letters of the name's first two words, and follows the name as it changes.",
      elementSelector(id, '[data-tour-part="person-initials"]'),
    ),
    onGraphic(
      'report',
      'Add a Report',
      ctx.touch
        ? 'Add Child adds someone who reports to this person.'
        : 'Press Tab, or Add Child, for someone who reports here. Then type their name.',
      toolbarButton('Add Child'),
    ),
    onGraphic(
      'peer',
      'Add a Peer',
      `${ctx.touch ? 'Add Sibling' : 'Press Enter, or Add Sibling,'} for a teammate with the same manager.`,
      toolbarButton('Add Sibling'),
    ),
    onGraphic(
      'team',
      ctx.hasReports ? 'Move a Whole Team' : 'Teams Move Together',
      `Drag a person and ${ctx.hasReports ? 'their whole team comes with them' : 'everyone under them comes too'}.`,
      elementSelector(id),
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'menu',
            'The Mind Map Menu',
            'In its menu, Mind Map tidies the chart or lets you edit it as a list.',
            ['Tools', 'Mind Map'],
          ),
        ]
      : []),
    conceptOutro(
      'That Is an Org Chart',
      ctx.touch
        ? 'Undo takes back any change.'
        : 'Tab, type, Enter, type: a whole team without the mouse.',
    ),
  ];
}
