// docs/specs/013-workspace/explorer-home.md "Jump Back In": a card's menu opens beside the card, out of its way.

import { describe, expect, it } from 'vitest';
import { BESIDE_GAP, besideSpot } from './beside-placement';

const card = (left: number, width: number) => ({ left, right: left + width, top: 50 });

describe('besideSpot', () => {
  it('prefers the right, top level with the card', () => {
    expect(besideSpot(card(100, 200), 224, 1000, 8)).toEqual({ left: 300 + BESIDE_GAP, top: 50 });
  });

  it('fits exactly against the window margin on the right', () => {
    const right = 1000 - 8 - 224 - BESIDE_GAP;
    expect(besideSpot(card(right - 200, 200), 224, 1000, 8)).toEqual({
      left: right + BESIDE_GAP,
      top: 50,
    });
    expect(besideSpot(card(right - 199, 200), 224, 1000, 8)?.left).toBe(
      right - 199 - BESIDE_GAP - 224,
    );
  });

  it('takes the left when the right has no room, and nothing when neither has', () => {
    expect(besideSpot(card(600, 300), 224, 1000, 8)).toEqual({
      left: 600 - BESIDE_GAP - 224,
      top: 50,
    });
    expect(besideSpot(card(100, 800), 224, 1000, 8)).toBeNull();
  });
});
