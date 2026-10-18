import type { ElementTourApi } from './element-tour-api';
import { conceptOutro, inTheMenu, onGraphic } from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Mind Map tour (docs/specs/007-editor/element-tours.md "The Mind Map tour"), on a selected mind node: growing a
// map from the keyboard (Tab, Enter) or the toolbar, a branch carried as one, and the Mind Map menu's shapes, spacing,
// Tidy Map and Edit Outline. It points at the node and its toolbar; it never grows the map itself.

export type MindNodeTourContext = {
  elementId: string;
  hasMore: boolean;
  touch: boolean;
  // The node has nodes grown from it, so dragging it carries a branch.
  hasChildren: boolean;
};

const toolbarButton = (label: string) =>
  `[data-testid="selection-popover"] button[aria-label="${label}"]`;

export function mindNodeTourSteps(ctx: MindNodeTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'node',
      'A Node That Knows Its Parent',
      'Every idea you add connects to this one, and the map tidies itself as it grows.',
      elementSelector(id),
    ),
    onGraphic(
      'child',
      'Grow a Child',
      ctx.touch
        ? 'Add Child adds an idea under this one.'
        : 'Press Tab, or Add Child, for an idea under this one. Then just type.',
      toolbarButton('Add Child'),
    ),
    onGraphic(
      'sibling',
      'Add a Sibling',
      ctx.touch
        ? 'Add Sibling adds an idea beside this one.'
        : 'Press Enter, or Add Sibling, for an idea beside this one. Shift+Enter starts a new line.',
      toolbarButton('Add Sibling'),
    ),
    onGraphic(
      'branch',
      ctx.hasChildren ? 'Move a Whole Branch' : 'Branches Move as One',
      `Drag an idea and ${ctx.hasChildren ? 'its whole branch comes with it' : 'everything under it comes too'}.`,
      elementSelector(id),
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'menu',
            'The Mind Map Menu',
            'In its menu, Mind Map changes the layout, tidies the map, or lets you edit it as a list.',
          ),
        ]
      : []),
    conceptOutro(
      'That Is a Mind Map',
      ctx.touch
        ? 'Undo takes back any change.'
        : 'Tab, type, Enter, type: a whole map without the mouse.',
    ),
  ];
}
