// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerPlanBoardTarget, type PlanBoardTarget } from './plan-board-targets';
import {
  PLAN_WIDGET_MISSED,
  dropPlanWidgetAt,
  endPlanWidgetDrag,
  planWidgetDragOver,
  widgetSlotAt,
} from './plan-widget-drop';

// docs/specs/026-plan/board-widgets.md "Placing and arranging widgets".
function rect(left: number, top: number, width: number, height: number): () => DOMRect {
  return () => ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
}

function boardDom(id: string, widgets: string[]) {
  const root = document.createElement('div');
  root.dataset.planBoard = id;
  const header = document.createElement('div');
  header.dataset.boardHeader = '';
  header.getBoundingClientRect = rect(0, 0, 600, 52);
  const zone = document.createElement('div');
  zone.dataset.widgetZone = '';
  widgets.forEach((w, i) => {
    const el = document.createElement('div');
    el.dataset.widget = w;
    el.getBoundingClientRect = rect(100 + i * 100, 10, 80, 28);
    zone.appendChild(el);
  });
  header.appendChild(zone);
  root.appendChild(header);
  document.body.appendChild(root);
  return { root, zone };
}

function target(patch: Partial<PlanBoardTarget> = {}): PlanBoardTarget {
  return {
    accepts: () => true,
    refusal: () => '',
    drop: vi.fn(),
    hover: vi.fn(),
    acceptsType: () => true,
    addCard: vi.fn(),
    canEditWidgets: () => true,
    widgetHover: vi.fn(),
    placeWidget: vi.fn(),
    ...patch,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('widgetSlotAt', () => {
  it('counts the widgets whose middle is left of the point', () => {
    const { zone } = boardDom('b', ['count', 'filter', 'mine']);
    expect(widgetSlotAt(zone, 50)).toBe(0);
    expect(widgetSlotAt(zone, 150)).toBe(1);
    expect(widgetSlotAt(zone, 260)).toBe(2);
    expect(widgetSlotAt(zone, 900)).toBe(3);
  });

  it('skips the widget being dragged as a landmark', () => {
    const { zone } = boardDom('b', ['count', 'filter', 'mine']);
    expect(widgetSlotAt(zone, 900, 'mine')).toBe(2);
  });
});

describe('a palette widget', () => {
  it('shows its place over a header, and lands there', () => {
    const { root, zone } = boardDom('b1', ['count', 'filter']);
    const t = target();
    const off = registerPlanBoardTarget('b1', t);
    document.elementsFromPoint = () => [zone, root];
    expect(planWidgetDragOver(150, 20)).toBe(true);
    expect(t.widgetHover).toHaveBeenLastCalledWith(1);
    expect(dropPlanWidgetAt('due', 150, 20)).toEqual({ placed: true });
    expect(t.placeWidget).toHaveBeenCalledWith('due', 1);
    expect(t.widgetHover).toHaveBeenLastCalledWith(null);
    off();
  });

  it('misses below the header, off a board, or on a board it may not change', () => {
    const { root, zone } = boardDom('b2', []);
    const off = registerPlanBoardTarget('b2', target());
    document.elementsFromPoint = () => [zone, root];
    expect(dropPlanWidgetAt('due', 150, 200)).toEqual({
      placed: false,
      message: PLAN_WIDGET_MISSED,
    });
    document.elementsFromPoint = () => [];
    expect(planWidgetDragOver(150, 20)).toBe(false);
    expect(dropPlanWidgetAt('due', 150, 20).placed).toBe(false);
    off();
    const t = target({ canEditWidgets: () => false });
    const off2 = registerPlanBoardTarget('b2', t);
    document.elementsFromPoint = () => [zone, root];
    expect(planWidgetDragOver(150, 20)).toBe(false);
    expect(dropPlanWidgetAt('due', 150, 20).placed).toBe(false);
    endPlanWidgetDrag();
    off2();
  });
});
