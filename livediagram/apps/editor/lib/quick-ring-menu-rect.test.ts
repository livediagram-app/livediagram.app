// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { quickRingMenuRect } from './quick-ring-menu-rect';

describe('quickRingMenuRect', () => {
  const plus = { x: 100, y: 200 };
  const menu = { width: 40, height: 160 };

  it('fans a side ring outward, centred on the plus', () => {
    expect(quickRingMenuRect(plus, menu, 'right', 20)).toMatchObject({ x: 120, y: 120 });
    expect(quickRingMenuRect(plus, menu, 'left', 20)).toMatchObject({ x: 40, y: 120 });
  });

  it('fans a top or bottom ring outward, centred on the plus', () => {
    const row = { width: 160, height: 40 };
    expect(quickRingMenuRect(plus, row, 'below', 20)).toMatchObject({ x: 20, y: 220 });
    expect(quickRingMenuRect(plus, row, 'above', 20)).toMatchObject({ x: 20, y: 140 });
  });
});
