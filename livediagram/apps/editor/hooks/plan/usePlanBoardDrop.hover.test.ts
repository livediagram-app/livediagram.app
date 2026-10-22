// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, presetSetup, projectBoard, type Item } from '@livediagram/items';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { planBoardTarget, sameIncoming } from './plan-board-targets';
import { usePlanBoardDrop } from './usePlanBoardDrop';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// A palette card held still over a board hovers again on every pointermove: the board re-renders only
// when the gap it draws changes.
describe('a board under a held card', () => {
  const setup = presetSetup('kanban');
  const status = setup.columns[0]!.status;
  const element = { ...createShape('plan-board', 0, 0), id: 'hover-board' } as ShapeElement;
  const items: ReadonlyMap<string, Item> = new Map();
  const plan = {
    types: ITEM_TYPES,
    canEdit: true,
    statusNames: new Map(),
    announce: vi.fn(),
  } as unknown as PlanContextValue;
  const hover = (beforeId: string | null = null, refused?: string) => ({
    itemId: '',
    slot: { status, laneKey: '', beforeId },
    height: 56,
    ...(refused ? { refused } : {}),
  });

  it('keeps its state through identical hovers and changes it for a new slot', () => {
    let renders = 0;
    const hook = renderHook(() => {
      renders += 1;
      return usePlanBoardDrop({
        element,
        boardRef: { current: null },
        plan,
        setup,
        projection: projectBoard(setup, items, undefined, ITEM_TYPES),
        items,
        interactive: true,
        canEdit: true,
      });
    });
    const target = planBoardTarget('hover-board')!;
    act(() => target.hover(hover()));
    const first = hook.result.current.incoming;
    const afterFirst = renders;
    act(() => target.hover(hover()));
    act(() => target.hover(hover()));
    expect(renders).toBe(afterFirst);
    expect(hook.result.current.incoming).toBe(first);
    act(() => target.hover(hover('x')));
    expect(renders).toBe(afterFirst + 1);
    act(() => target.hover(null));
    act(() => target.hover(null));
    expect(renders).toBe(afterFirst + 2);
    expect(hook.result.current.incoming).toBeNull();
    hook.unmount();
  });

  it('compares slot, height and refusal', () => {
    const lane = (laneKey: string, s = status) => ({
      ...hover(),
      slot: { status: s, laneKey, beforeId: null },
    });
    expect(sameIncoming(hover(), hover())).toBe(true);
    expect(sameIncoming(null, null)).toBe(true);
    expect(sameIncoming(hover(), null)).toBe(false);
    expect(sameIncoming(hover(), hover('x'))).toBe(false);
    expect(sameIncoming(hover(), hover(null, 'No'))).toBe(false);
    expect(sameIncoming(hover(), { ...hover(), height: 40 })).toBe(false);
    expect(sameIncoming(hover(), lane('', 'other'))).toBe(false);
    expect(sameIncoming(hover(), lane('l'))).toBe(false);
  });
});
