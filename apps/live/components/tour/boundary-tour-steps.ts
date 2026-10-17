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
      'A region, a VPC, a cluster, a trust zone: everything whose centre is inside moves with it. Nest one in another and the tint deepens.',
      elementSelector(id),
    ),
    onGraphic(
      'title',
      'Its Title',
      ctx.style === 'c4'
        ? `${doublePressWord(ctx)} it to rename it. In the C4 style the title sits bold in the bottom-left corner.`
        : `${doublePressWord(ctx)} it to rename it. Drop an icon from the palette onto it and the icon goes before the title.`,
      elementSelector(id),
    ),
    ...(ctx.hasMeta
      ? [
          onGraphic(
            'meta',
            'The Meta Line',
            `A second line: a CIDR range, or a C4 type. ${pressWord(ctx)} it to type over it.`,
            elementSelector(id, '[aria-label="Boundary meta line"]'),
          ),
        ]
      : []),
    menuStep(
      ctx,
      'menu',
      'Three Styles',
      'Tools, then Boundary: Tab (the cloud look), Inset (for a zone inside another) or C4, and Meta Line on or off.',
    ),
    conceptOutro(
      'That Is a Boundary',
      'Arrows join it like any shape (Internet to VPC), and every change is one undo step.',
    ),
  ];
}
