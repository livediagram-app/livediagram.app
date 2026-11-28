import { describe, expect, it } from 'vitest';
import {
  applyShapeVariant,
  changesType,
  createShape,
  mountedFace,
  pieceVariant,
  retypePiece,
  SCREEN_VARIANTS,
  storesVariant,
  type Element,
  type ShapeElement,
} from './index';

// docs/specs/009-elements/screen-and-room-sign.md "Sizes": a Screen is placed at one of five sizes, kept in `variant`,
// and changes size in place from the element menu's Type section, staying on its wall.

describe('Screen sizes', () => {
  it('stores its size, the Medium (its own default) when absent', () => {
    expect(storesVariant('screen')).toBe(true);
    expect(changesType('screen')).toBe(true);
    const plain = createShape('screen', 0, 0);
    expect(pieceVariant(plain)).toBe('medium');
    expect([plain.width, plain.height]).toEqual([192, 120]);
  });

  it('places each size at its box, 16 by 10, aspect locked', () => {
    const sizes = SCREEN_VARIANTS.slice(1).map((v) => {
      const el = applyShapeVariant(createShape('screen', 0, 0), v);
      expect(el.variant).toBe(v);
      expect(el.width / el.height).toBeCloseTo(1.6);
      expect(el.aspectLocked).toBe(true);
      return el.width;
    });
    expect(sizes).toEqual([96, 144, 320, 640]);
  });

  it('changes size in place keeping its back on its wall and its middle along it', () => {
    const room = { ...createShape('room', 0, 0), id: 'r', width: 800, height: 400 } as Element;
    // Hung on the room's back wall's standing face, as snapToWallFace hangs it.
    const screen = { ...createShape('screen', 300, 4), id: 's' } as ShapeElement;
    expect(mountedFace(screen, [room, screen])).not.toBeNull();
    const big = retypePiece(screen, 'cinema', [room, screen]);
    expect([big.width, big.height]).toEqual([640, 400]);
    expect(big.variant).toBe('cinema');
    expect(big.y).toBe(screen.y);
    expect(big.x + big.width / 2).toBe(screen.x + screen.width / 2);
    // Back to the Medium clears the variant.
    const back = retypePiece(big, 'medium', [room, big]);
    expect(back.variant).toBeUndefined();
    expect([back.width, back.height, back.y]).toEqual([192, 120, screen.y]);
  });
});
