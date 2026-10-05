// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShape, type Element } from '@livediagram/document';
import { hasPlanContent, usePlanNeeded } from './usePlanNeeded';

// docs/specs/025-plan/plan-mode.md "Cost".
describe('usePlanNeeded', () => {
  const board = createShape('plan-board', 0, 0) as Element;
  const square = createShape('square', 0, 0) as Element;

  it('needs items only with a Plan element or a card slide', () => {
    expect(hasPlanContent([square], null)).toBe(false);
    expect(hasPlanContent([square, board], null)).toBe(true);
    expect(hasPlanContent([], '{"decks":[{"slides":[{"itemId":"x"}]}]}')).toBe(true);
  });

  it('stays needed once it has been', () => {
    const { result, rerender } = renderHook(({ els }) => usePlanNeeded(els, null), {
      initialProps: { els: [square] },
    });
    expect(result.current).toBe(false);
    rerender({ els: [board] });
    expect(result.current).toBe(true);
    rerender({ els: [square] });
    expect(result.current).toBe(true);
  });
});

describe('usePlanNeeded on a Plan tab', () => {
  it('fetches for a tab that opens in Plan, board or not', () => {
    const { result } = renderHook(() => usePlanNeeded([], null, true));
    expect(result.current).toBe(true);
  });
});
