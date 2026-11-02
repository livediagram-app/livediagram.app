import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { doublePressWord, menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Lane tour (docs/specs/007-editor/element-tours.md "The Lane tour"), on a selected lane: a band per role, its
// title gutter (`data-lane-gutter`) and the seam that sizes it, what it carries, and turning it into a column.

type LaneTourContext = MenuTourEnv;

export function laneTourSteps(ctx: LaneTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'lane',
      'A Band for Each Role',
      'One lane per role or team. Stack lanes and they snap together.',
      elementSelector(id),
    ),
    onGraphic(
      'gutter',
      'The Title Gutter',
      `${doublePressWord(ctx)} the lane to name it.`,
      elementSelector(id, '[data-lane-gutter]'),
    ),
    onGraphic(
      'seam',
      'Drag the Seam',
      'Drag this edge to give the title more or less room.',
      elementSelector(id, '[data-lane-seam]'),
    ),
    onGraphic(
      'carry',
      'Carries Its Steps',
      'Drag the lane and everything in it comes too.',
      elementSelector(id),
    ),
    menuStep(
      ctx,
      'menu',
      'Rows or Columns',
      'Text: put the title on top to make the lane a column.',
      ['Text'],
    ),
    conceptOutro('That Is a Lane', 'Undo takes back any change.'),
  ];
}
