import { conceptOutro, inElement, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { doublePressWord, menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';

// The Lane tour (docs/specs/007-editor/element-tours.md "The Lane tour"), on a selected lane: a band per role, its
// title gutter (`data-lane-gutter`) and the seam that sizes it, what it carries, and turning it into a column.

export type LaneTourContext = MenuTourEnv;

export function laneTourSteps(ctx: LaneTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'lane',
      'A Band for Each Role',
      'A swimlane: a role, a team or a system per lane, with its steps inside. Stack lanes edge to edge; they snap together.',
      inElement(id),
    ),
    onGraphic(
      'gutter',
      'The Title Gutter',
      `${doublePressWord(ctx)} the lane to name it; the name sits in this gutter. Its colour is Heading, under Colours.`,
      inElement(id, '[data-lane-gutter]'),
    ),
    onGraphic(
      'seam',
      'Drag the Seam',
      'Drag where the gutter meets the body to give the title more room or less. It snaps to the seams of the lanes around it, so they line up.',
      inElement(id, '[data-lane-seam]'),
    ),
    onGraphic(
      'carry',
      'Carries Its Steps',
      'Drag the lane and everything inside it comes too, as with a frame.',
      inElement(id),
    ),
    menuStep(
      ctx,
      'menu',
      'Rows or Columns',
      'Text: centre the title at the top and the lane turns into a column with a header band. Upright Title turns a side title to read from bottom to top.',
    ),
    conceptOutro('That Is a Lane', 'Every change is one undo step, a whole seam drag included.'),
  ];
}
