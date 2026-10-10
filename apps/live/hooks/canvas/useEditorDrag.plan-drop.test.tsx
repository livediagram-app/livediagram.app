// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { localPreview, resetDragPreviewForTests } from '@/lib/drag-preview';
import { planCardCanvasDropAt } from './plan-card-canvas-drop';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/item-types.md "An item type": a canvas Plan card dropped on a board that refuses it goes
// back to where the drag started, with no undo step; one the board takes files there as before.

const CARD: Element = {
  id: 'card',
  type: 'shape',
  shape: 'plan-card',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  planCard: { itemId: 'i1' },
} as Element;

// A board's column under the pointer, as the board draws it.
function boardCell(status: string): HTMLElement {
  const board = document.createElement('div');
  board.dataset.planBoard = 'board-1';
  const cell = document.createElement('div');
  cell.dataset.planStatus = status;
  board.appendChild(cell);
  document.body.appendChild(board);
  return cell;
}

function harness(answer: 'refused' | undefined) {
  let elements: Element[] = [CARD];
  const calls = { tick: 0, commit: 0, checkpoint: 0 };
  const onPlanCardDroppedOnBoard = vi.fn(() => answer);
  const deps = {
    get activeTab() {
      return { id: 't', name: 'Tab', elements } as Tab;
    },
    zoomRef: { current: 1 },
    setSelectedId: vi.fn(),
    readSelection: () => ({ selectedId: 'card', multiSelectedIds: new Set<string>() }),
    setMultiSelectedIds: vi.fn(),
    editingId: null,
    isReadOnly: false,
    layerInertIds: new Set<string>(),
    formatSourceId: null,
    applyFormatFromSource: vi.fn(),
    formatToolActive: false,
    setFormatSourceId: vi.fn(),
    connectSourceId: null,
    connectArrowTo: vi.fn(),
    tick: (m: (els: Element[]) => Element[]) => {
      calls.tick += 1;
      elements = m(elements);
    },
    commit: (m: (els: Element[]) => Element[]) => {
      calls.commit += 1;
      elements = m(elements);
    },
    markCheckpoint: () => {
      calls.checkpoint += 1;
    },
    cancelToCheckpoint: vi.fn(),
    styleNewElement: <T,>(el: T) => el,
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
    insertGate: { esBoard: false, readOnly: false, tabLocked: false, createBlocked: false },
    onPlanCardDroppedOnBoard,
  } as unknown as EditorDragDeps;
  const view = renderHook(() => useEditorDrag(deps));
  const press = () =>
    act(() => {
      view.result.current.beginDrag('card', 'move', {
        clientX: 50,
        clientY: 30,
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
      } as unknown as Parameters<typeof view.result.current.beginDrag>[2]);
    });
  const pointer = (type: 'pointermove' | 'pointerup', x: number) =>
    act(() => {
      window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 30 }));
    });
  const xOf = () => (elements.find((e) => e.id === 'card') as { x: number }).x;
  return { press, pointer, calls, xOf, onPlanCardDroppedOnBoard };
}

let underPointer: HTMLElement[] = [];
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(performance.now());
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  underPointer = [boardCell('done')];
  document.elementsFromPoint = () => underPointer;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetDragPreviewForTests();
  document.body.innerHTML = '';
});

describe('a canvas Plan card dropped on a board', () => {
  it('goes back to where the drag started when the board refuses it, leaving no undo step', () => {
    const h = harness('refused');
    h.press();
    h.pointer('pointermove', 250);
    h.pointer('pointerup', 250);
    expect(h.onPlanCardDroppedOnBoard).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'card' }),
      'done',
      'board-1',
    );
    expect(h.xOf()).toBe(0);
    expect(h.calls).toEqual({ tick: 0, commit: 0, checkpoint: 0 });
    expect(localPreview()).toBeNull();
  });

  it('lands where it was dropped when the board takes it, in one undo step', () => {
    const h = harness(undefined);
    h.press();
    h.pointer('pointermove', 250);
    h.pointer('pointerup', 250);
    expect(h.onPlanCardDroppedOnBoard).toHaveBeenCalledTimes(1);
    expect(h.xOf()).toBe(200);
    expect(h.calls.checkpoint).toBe(1);
  });

  it('is not a drop over no column', () => {
    underPointer = [];
    const h = harness('refused');
    h.press();
    h.pointer('pointermove', 250);
    h.pointer('pointerup', 250);
    expect(h.onPlanCardDroppedOnBoard).not.toHaveBeenCalled();
    expect(h.xOf()).toBe(200);
  });
});

describe('planCardCanvasDropAt', () => {
  const start = { x: 50, y: 30 };
  it('reads the column and its board under the pointer', () => {
    expect(planCardCanvasDropAt([CARD], 'card', start, 250, 30)).toEqual({
      card: CARD,
      status: 'done',
      boardId: 'board-1',
    });
  });

  it('is null for a click, an element that is not a Plan card, or a column outside a board', () => {
    expect(planCardCanvasDropAt([CARD], 'card', start, 52, 30)).toBeNull();
    const box = { ...CARD, id: 'box', shape: 'square' } as Element;
    expect(planCardCanvasDropAt([box], 'box', start, 250, 30)).toBeNull();
    const loose = document.createElement('div');
    loose.dataset.planStatus = 'todo';
    underPointer = [loose];
    expect(planCardCanvasDropAt([CARD], 'card', start, 250, 30)).toEqual({
      card: CARD,
      status: 'todo',
    });
  });
});
