import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { doublePressWord, menuStep, pressWord, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Boundary tour (docs/specs/007-editor/element-tours.md "The Boundary tour"), on a selected boundary: a zone that
// holds what is inside it, its title (and icon), its meta line, and its three styles.

type BoundaryTourContext = MenuTourEnv & {
  style: 'tab' | 'inset' | 'c4';
  // It shows a meta line to ring.
  hasMeta: boolean;
};

export function boundaryTourSteps(ctx: BoundaryTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'zone',
      'A Zone That Holds Things',
      'A region, a VPC, a trust zone. Whatever sits inside moves with it. Nest them for deeper zones.',
      elementSelector(id),
    ),
    onGraphic(
      'title',
      'Its Title',
      ctx.style === 'c4'
        ? `${doublePressWord(ctx)} it to rename it.`
        : `${doublePressWord(ctx)} it to rename it. Drop an icon on it to put one before the name.`,
      elementSelector(id),
    ),
    ...(ctx.hasMeta
      ? [
          onGraphic(
            'meta',
            'The Meta Line',
            `An optional second line, like a CIDR range. ${pressWord(ctx)} it to edit.`,
            elementSelector(id, '[aria-label="Boundary meta line"]'),
          ),
        ]
      : []),
    menuStep(ctx, 'menu', 'Three Styles', 'Tools › Boundary picks the style: Tab, Inset or C4.'),
    conceptOutro(
      'That Is a Boundary',
      'Arrows connect to it like any shape. Undo takes back any change.',
    ),
  ];
}
