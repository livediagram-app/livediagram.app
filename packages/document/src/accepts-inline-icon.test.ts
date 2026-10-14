import { describe, expect, it } from 'vitest';
import { acceptsInlineIcon, positionsInlineIcon } from './colors';
import { hasOwnFace } from './collab-shapes';
import { createShape } from './factories';
import { SHAPE_KINDS } from './validate';
import type { ShapeKind } from './index';

// An icon only folds into an element whose face draws it
// (docs/specs/008-canvas/canvas-and-palette.md): a Behaviour element's own face never renders an inline
// icon, so one dropped on it stands alone instead of vanishing.

describe('acceptsInlineIcon', () => {
  it('refuses every kind that draws its own face', () => {
    const own = ([...SHAPE_KINDS] as ShapeKind[]).filter(hasOwnFace);
    expect(own.length).toBeGreaterThan(5);
    for (const kind of own) expect(acceptsInlineIcon(createShape(kind, 0, 0)), kind).toBe(false);
  });

  it('still folds into an ordinary shape', () => {
    expect(acceptsInlineIcon(createShape('square', 0, 0))).toBe(true);
    expect(acceptsInlineIcon(createShape('diamond', 0, 0))).toBe(true);
  });
});

describe('positionsInlineIcon', () => {
  it('takes an icon on a card, callout, header or boundary but leaves its place to the kind', () => {
    for (const kind of ['card', 'callout', 'site-header', 'boundary'] as const) {
      expect(acceptsInlineIcon(createShape(kind, 0, 0)), kind).toBe(true);
      expect(positionsInlineIcon(createShape(kind, 0, 0)), kind).toBe(false);
    }
    expect(positionsInlineIcon(createShape('square', 0, 0))).toBe(true);
    expect(positionsInlineIcon(createShape('icon', 0, 0))).toBe(false);
  });
});
