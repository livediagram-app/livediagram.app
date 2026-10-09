// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { useFocusNewPlanElement } from './useFocusNewPlanElement';

const board = { ...createShape('plan-board', 10, 20), id: 'b1' } as Element;
const sheet = { ...createShape('plan-sheet', 0, 0), id: 's1' } as Element;
const square = { ...createShape('square', 0, 0), id: 'q1' } as Element;

function setup(selected: string | null) {
  const focus = vi.fn();
  const view = renderHook(
    ({ tabId, elements }: { tabId: string; elements: Element[] }) =>
      useFocusNewPlanElement({ tabId, elements, selectedId: () => selected, focus }),
    { initialProps: { tabId: 't1', elements: [square] } },
  );
  return { focus, view };
}

describe('focusing a newly added board, visualisation or Sheet', () => {
  it('glides to the one this person just added', () => {
    const { focus, view } = setup('b1');
    view.rerender({ tabId: 't1', elements: [square, board] });
    expect(focus).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      w: board.type === 'shape' ? board.width : 0,
      h: board.type === 'shape' ? board.height : 0,
    });
  });

  it('leaves a peer’s add, another kind, a tab switch and the first load alone', () => {
    const { focus, view } = setup('q2');
    view.rerender({ tabId: 't1', elements: [square, sheet] });
    view.rerender({ tabId: 't2', elements: [square, sheet, board] });
    expect(focus).not.toHaveBeenCalled();
    const other = setup('q9');
    other.view.rerender({ tabId: 't1', elements: [square, { ...square, id: 'q9' } as Element] });
    expect(other.focus).not.toHaveBeenCalled();
  });
});
