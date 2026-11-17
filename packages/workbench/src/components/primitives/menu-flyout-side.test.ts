// Which side a flyout opens on (menu-flyout-side.ts, docs/specs/008-canvas/canvas-and-palette.md "A flyout can
// hold a flyout"). The render tests in MenuFlyoutSection.test.tsx cover the chain; these pin each branch.

import { describe, expect, it } from 'vitest';

import { flyoutSide } from './menu-flyout-side';

const base = { width: 200, viewportWidth: 1000, margin: 8, gap: 2 };

describe('flyoutSide', () => {
  it('opens right beside a host-menu row with room', () => {
    expect(
      flyoutSide({ ...base, trigger: { left: 100, right: 300 }, chain: null, prefer: 'right' }),
    ).toEqual({ side: 'right', left: 302 });
  });

  it('flips a host-menu row left when the right has no room', () => {
    expect(
      flyoutSide({ ...base, trigger: { left: 700, right: 900 }, chain: null, prefer: 'right' }),
    ).toEqual({ side: 'left', left: 498 });
  });

  it('keeps a nested flyout on the left its parent flipped to', () => {
    expect(
      flyoutSide({
        ...base,
        trigger: { left: 500, right: 700 },
        chain: { left: 500, right: 900 },
        prefer: 'left',
      }),
    ).toEqual({ side: 'left', left: 298 });
  });

  it('crosses a left-flipped chain to the right of it when the left has no room', () => {
    expect(
      flyoutSide({
        ...base,
        trigger: { left: 100, right: 300 },
        chain: { left: 100, right: 500 },
        prefer: 'left',
      }),
    ).toEqual({ side: 'right', left: 502 });
  });

  it('opens on the roomier side, beside its row, when neither side clears the chain', () => {
    // Right of the row: 1000 - 8 - 502 = 490 of room; left: 300 - 2 - 8 = 290.
    expect(
      flyoutSide({
        ...base,
        width: 600,
        trigger: { left: 300, right: 500 },
        chain: { left: 300, right: 700 },
        prefer: 'left',
      }),
    ).toEqual({ side: 'right', left: 502 });
    // Right of the row: 1000 - 8 - 802 = 190; left: 600 - 2 - 8 = 590.
    expect(
      flyoutSide({
        ...base,
        width: 600,
        trigger: { left: 600, right: 800 },
        chain: { left: 400, right: 800 },
        prefer: 'right',
      }),
    ).toEqual({ side: 'left', left: -2 });
  });
});
