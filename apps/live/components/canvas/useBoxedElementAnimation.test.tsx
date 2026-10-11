// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livediagram/document';
import { maximisePlanElement, releasePlanElement } from '@/hooks/plan/maximised-plan';
import { setPlanCover } from '@/hooks/plan/plan-cover-store';
import { useBoxedElementAnimation } from './useBoxedElementAnimation';

// docs/specs/028-animation/element-animations.md: a board, view or Sheet filling the canvas (maximised, or Fill
// Tab) holds still; in its place on the canvas its animation plays.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(() => {
  act(() => {
    releasePlanElement('b');
    setPlanCover({ fillTabId: null, fillTabKind: null, tabElementCount: 0 });
  });
});

const board = { ...createShape('plan-board', 0, 0), id: 'b', animation: 'pulse' } as BoxedElement;
const box = { ...createShape('square', 0, 0), id: 'r', animation: 'pulse' } as BoxedElement;

describe('a covering element’s animation', () => {
  it('plays in place and stops while maximised or filling the tab', () => {
    const { result } = renderHook(() => useBoxedElementAnimation(board, '#000'));
    expect(result.current.layerAnim).toBe('pulse');
    act(() => maximisePlanElement('b'));
    expect(result.current.layerAnim).toBeUndefined();
    act(() => releasePlanElement('b'));
    expect(result.current.layerAnim).toBe('pulse');
    act(() => setPlanCover({ fillTabId: 'b', fillTabKind: 'Board', tabElementCount: 1 }));
    expect(result.current.layerAnim).toBeUndefined();
  });

  it('leaves every other element animating', () => {
    act(() => maximisePlanElement('b'));
    const { result } = renderHook(() => useBoxedElementAnimation(box, '#000'));
    expect(result.current.layerAnim).toBe('pulse');
  });
});
