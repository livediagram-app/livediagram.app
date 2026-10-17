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
      'A mind node belongs to a map: every node grown from it is joined to it by a line, and the map keeps itself tidy as it grows.',
      elementSelector(id),
    ),
    onGraphic(
      'child',
      'Grow a Child',
      ctx.touch
        ? 'Add Child grows a new node off this one, placed and joined, ready to type into.'
        : 'Tab, or Add Child here, grows a new node off this one, placed and joined. Just start typing to name it.',
      toolbarButton('Add Child'),
    ),
    onGraphic(
      'sibling',
      'Add a Sibling',
      ctx.touch
        ? 'Add Sibling puts a new node beside this one, under the same parent.'
        : 'Enter, or Add Sibling, puts a new node beside this one. Shift+Enter starts a new line while you type.',
      toolbarButton('Add Sibling'),
    ),
    onGraphic(
      'branch',
      ctx.hasChildren ? 'Move a Whole Branch' : 'Branches Move as One',
      `Drag a node and ${ctx.hasChildren ? 'its whole branch comes with it' : 'every node grown from it comes too'}: a branch is one idea.`,
      elementSelector(id),
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'menu',
            'The Mind Map Menu',
            'Under Mind Map: Branching picks the shape it grows in (tree, balanced, downward and more), Spacing, Tidy Map to lay it out again, and Edit Outline to write the whole map as a list.',
          ),
        ]
      : []),
    conceptOutro(
      'That Is a Mind Map',
      ctx.touch
        ? 'Every change is one undo step.'
        : 'Tab, type, Enter, type: a whole map without touching the mouse.',
    ),
  ];
}
