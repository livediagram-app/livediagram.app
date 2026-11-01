// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, labelFontPx, type BoxedElement, type TextSize } from '@livedesign/design';
import { useElementIndicators } from './useElementIndicators';

// docs/specs/007-editor/pages-mode.md "Sizes": the indicators make room for a re-fitted label at the
// size it draws, its size times its scale.
const layout = vi.hoisted(() => vi.fn((..._args: unknown[]) => null));
vi.mock('./useIndicatorLayout', () => ({ useIndicatorLayout: layout }));

const handlers = {
  onFollowLink: vi.fn(),
  onOpenComments: vi.fn(),
  onOpenAction: vi.fn(),
  onOpenNote: vi.fn(),
  tabSummaries: [],
};
const label = {
  text: 'Continue',
  padding: 14,
  alignX: 'center',
  alignY: 'middle',
  inlineIcon: false,
} as const;
const fontPxFor = (el: BoxedElement, textSize: TextSize = 16) => {
  renderHook(() => useElementIndicators(el, handlers, { ...label, textSize }, 8));
  return (layout.mock.lastCall![3] as { fontPx?: number }).fontPx;
};

describe('the indicators around a re-fitted label', () => {
  const button = { ...createShape('square', 0, 0), note: 'n', textSize: 16 } as BoxedElement;

  it('measure it at its size times its scale', () => {
    expect(fontPxFor({ ...button, textScale: 0.5 } as BoxedElement)).toBe(labelFontPx(16) / 2);
  });

  it("leave an unscaled label, and a label fitted to its box, to the size's own px", () => {
    expect(fontPxFor(button)).toBeUndefined();
    expect(fontPxFor({ ...button, textScale: 0.5 } as BoxedElement, 'scale')).toBeUndefined();
  });
});
