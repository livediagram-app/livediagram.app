import { describe, expect, it } from 'vitest';
import { acceptsInlineIcon, positionsInlineIcon } from './colors';
import { createShape } from './factories';

// An icon only folds into an element whose face draws it
// (docs/specs/008-canvas/canvas-and-palette.md): a face drawn whole never renders an inline icon, so one
// dropped on it stands alone instead of vanishing.

describe('acceptsInlineIcon', () => {
  it('refuses a face drawn whole with no place for an icon, so a dropped icon is never swallowed', () => {
    for (const kind of [
      'badge',
      'step',
      'layer-stack',
      'pyramid',
      'cycle',
      'hub',
      'onion',
      'chevrons',
      'tab-window',
    ] as const)
      expect(acceptsInlineIcon(createShape(kind, 0, 0)), kind).toBe(false);
  });

  it('still folds into an ordinary shape', () => {
    expect(acceptsInlineIcon(createShape('square', 0, 0))).toBe(true);
    expect(acceptsInlineIcon(createShape('diamond', 0, 0))).toBe(true);
  });
});

describe('positionsInlineIcon', () => {
  it('takes an icon on a card, callout or header but leaves its place to the kind', () => {
    for (const kind of ['card', 'callout', 'site-header'] as const) {
      expect(acceptsInlineIcon(createShape(kind, 0, 0)), kind).toBe(true);
      expect(positionsInlineIcon(createShape(kind, 0, 0)), kind).toBe(false);
    }
    expect(positionsInlineIcon(createShape('square', 0, 0))).toBe(true);
    expect(positionsInlineIcon(createShape('icon', 0, 0))).toBe(false);
  });
});
