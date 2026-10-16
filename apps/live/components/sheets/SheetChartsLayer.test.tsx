// @vitest-environment jsdom
// The charts that sit in a Sheet (docs/specs/029-sheets/sheet.md "Charts"): drawn over its cells at their anchors,
// moved, resized and deleted by an Editor as one undo step each, and only looked at by a Participant, a Viewer or a
// Dashboard slot showing another tab's Sheet.
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Element, ShapeElement } from '@livediagram/document';
import { SheetsBridgeContext, type SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { SheetChartsContext } from './sheet-charts-context';
import type { SheetChartRenderer } from '@/components/canvas/sheet-chart-renderer';
import { SheetChartsLayer } from './SheetChartsLayer';
import { placeSheetChart } from './sheet-charts';
import { makeSheet, renderSheet, SHEET_ID, type SheetHarness } from './sheet-ui-test-utils';

// Every element handed to the live chart, in order: a re-render that hands it a new object makes it read its range again.
const linked: ShapeElement[] = [];
vi.mock('./SheetLinkedChart', () => ({
  SheetLinkedChart: ({
    element,
    children,
  }: {
    element: ShapeElement;
    children: (el: ShapeElement) => ReactNode;
  }) => {
    linked.push(element);
    return <>{children(element)}</>;
  },
}));
vi.mock('@/components/canvas/DataChartView', () => ({
  DataChartView: ({ element }: { element: ShapeElement }) => (
    <span data-testid={`drawn-${element.id}`}>{`${element.width}x${element.height}`}</span>
  ),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const openElementMenu = vi.fn((_id: string, _at: DOMRect) => true);
vi.mock('@/hooks/canvas/element-menu-opener', () => ({
  openElementMenu: (id: string, at: DOMRect) => openElementMenu(id, at),
}));

const range = { r1: 'aaaa', c1: 'bbbb', r2: 'cccc', c2: 'dddd' };
const chart = (id: string, over: Partial<ShapeElement> = {}): ShapeElement =>
  ({
    id,
    type: 'shape',
    shape: 'bar-chart',
    x: 0,
    y: 0,
    width: 260,
    height: 220,
    chartSource: { sheetId: SHEET_ID, range },
    sheetAnchor: { x: 100, y: 50 },
    ...over,
  }) as ShapeElement;

let elements: Element[];
let bridge: SheetsBridge;
let h: SheetHarness;

function makeBridge(): SheetsBridge {
  return {
    commitElements: vi.fn<SheetsBridge['commitElements']>((map) => {
      elements = map(elements);
    }),
    placeElement: vi.fn<SheetsBridge['placeElement']>((_at, make) => {
      elements = [...elements, make(0, 0)];
    }),
  } as unknown as SheetsBridge;
}

function mount(
  opts: {
    canShape?: boolean;
    editable?: boolean;
    interactive?: boolean;
    renderChart?: SheetChartRenderer;
  } = {},
) {
  return renderSheet(
    h,
    () => (
      <SheetsBridgeContext.Provider value={bridge}>
        <SheetChartsContext.Provider
          value={{ elements, editable: opts.editable ?? true, renderChart: opts.renderChart }}
        >
          <SheetChartsLayer />
        </SheetChartsContext.Provider>
      </SheetsBridgeContext.Provider>
    ),
    { canShape: opts.canShape ?? true, interactive: opts.interactive ?? true },
  );
}

const box = (id: string) => document.querySelector<HTMLElement>(`[data-sheet-chart="${id}"]`)!;
const drag = (target: HTMLElement, dx: number, dy: number) => {
  fireEvent.pointerDown(target, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  act(() => {
    target.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 10 + dx, clientY: 10 + dy, bubbles: true }),
    );
  });
  act(() => {
    target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  });
};

beforeEach(async () => {
  linked.length = 0;
  openElementMenu.mockClear();
  elements = [];
  bridge = makeBridge();
  h = await makeSheet();
});
afterEach(cleanup);

describe('the charts in a Sheet', () => {
  it("draws this sheet's anchored charts at their anchors, and no other chart", () => {
    elements = [
      chart('mine'),
      chart('floating', { sheetAnchor: undefined }),
      chart('other', { chartSource: { sheetId: 'sheet0002', range } }),
    ];
    mount();
    expect(screen.getByTestId('drawn-mine').textContent).toBe('260x220');
    expect(screen.queryByTestId('drawn-floating')).toBeNull();
    expect(screen.queryByTestId('drawn-other')).toBeNull();
    expect(box('mine').style.left).toBe('100px');
    expect(box('mine').style.top).toBe('50px');
    // They scroll with the cells.
    act(() => h.ctl().setScroll({ top: 30, left: 40 }));
    expect(box('mine').style.left).toBe('60px');
    expect(box('mine').style.top).toBe('20px');
  });

  it('hands its live chart the element itself while scrolling, so the chart never reads its range again', () => {
    elements = [chart('c')];
    mount();
    act(() => h.ctl().setScroll({ top: 30, left: 40 }));
    act(() => h.ctl().setScroll({ top: 60, left: 80 }));
    expect(linked.length).toBeGreaterThan(1);
    expect(linked.every((el) => el === elements[0])).toBe(true);
  });

  it('draws nothing without any', () => {
    const { container } = mount();
    expect(container.querySelector('[data-sheet-charts]')).toBeNull();
  });

  it('shows a chart just inserted at once, selected', () => {
    placeSheetChart(
      bridge,
      { x: 0, y: 0, width: 900, height: 500 } as ShapeElement,
      SHEET_ID,
      'pie',
      { range },
      { x: 300, y: 24 },
    );
    expect(bridge.placeElement).toHaveBeenCalledTimes(1);
    mount();
    const id = (elements[0] as ShapeElement).id;
    expect(box(id).style.left).toBe('300px');
    expect(screen.getByRole('button', { name: 'Delete Chart' })).toBeTruthy();
    expect(document.activeElement).toBe(box(id));
  });

  it('moves a chart as one change, by the distance dragged', () => {
    elements = [chart('c')];
    mount();
    drag(box('c'), 30, -20);
    expect(bridge.commitElements).toHaveBeenCalledTimes(1);
    expect((elements[0] as ShapeElement).sheetAnchor).toEqual({ x: 130, y: 30 });
  });

  it('takes a press without a drag as a selection, changing nothing', () => {
    elements = [chart('c')];
    mount();
    drag(box('c'), 1, 1);
    expect(bridge.commitElements).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Chart' })).toBeTruthy();
  });

  it('resizes a chart from its corner as one change', () => {
    elements = [chart('c')];
    mount();
    fireEvent.focus(box('c'));
    const handle = box('c').querySelector<HTMLElement>('[data-sheet-chart-resize]')!;
    drag(handle, 40, -500);
    expect(bridge.commitElements).toHaveBeenCalledTimes(1);
    expect(elements[0]).toMatchObject({ width: 300, height: 120 });
  });

  it('deletes a chart with Delete, Backspace or Delete Chart, and lets it go with Escape', () => {
    elements = [chart('a'), chart('b'), chart('c')];
    const view = mount();
    fireEvent.keyDown(box('a'), { key: 'Delete' });
    expect(elements.map((e) => e.id)).toEqual(['b', 'c']);
    view.unmount();
    mount();
    fireEvent.keyDown(box('b'), { key: 'Backspace' });
    expect(elements.map((e) => e.id)).toEqual(['c']);
    cleanup();
    mount();
    fireEvent.focus(box('c'));
    fireEvent.keyDown(box('c'), { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Delete Chart' })).toBeNull();
    fireEvent.focus(box('c'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Chart' }));
    expect(elements).toEqual([]);
    expect(bridge.commitElements).toHaveBeenCalledTimes(3);
  });

  // WCAG 2.1.1 and 2.5.7: everything a drag does has a key.
  it('moves a selected chart with the arrows and resizes it with Alt and the arrows, one change a press', () => {
    elements = [chart('c')];
    mount();
    fireEvent.focus(box('c'));
    fireEvent.keyDown(box('c'), { key: 'ArrowRight' });
    expect((elements[0] as ShapeElement).sheetAnchor).toEqual({ x: 101, y: 50 });
    fireEvent.keyDown(box('c'), { key: 'ArrowUp', shiftKey: true });
    expect((elements[0] as ShapeElement).sheetAnchor).toEqual({ x: 101, y: 40 });
    fireEvent.keyDown(box('c'), { key: 'ArrowRight', altKey: true, shiftKey: true });
    fireEvent.keyDown(box('c'), { key: 'ArrowDown', altKey: true });
    expect(elements[0]).toMatchObject({ width: 270, height: 221 });
    expect(bridge.commitElements).toHaveBeenCalledTimes(4);
    expect(box('c').getAttribute('aria-keyshortcuts')).toContain('Alt+ArrowRight');
    expect(box('c').getAttribute('aria-description')).toMatch(/resize/);
  });

  it("keeps a selected chart's keys from the canvas's shortcuts, all but undo and redo", () => {
    elements = [chart('c')];
    mount();
    const heard: string[] = [];
    const listen = (e: KeyboardEvent) => heard.push(e.key);
    window.addEventListener('keydown', listen);
    try {
      fireEvent.keyDown(box('c'), { key: 'r' });
      fireEvent.keyDown(box('c'), { key: 'ArrowLeft' });
      fireEvent.keyDown(box('c'), { key: 'z', metaKey: true });
      fireEvent.keyDown(box('c'), { key: 'y', ctrlKey: true });
    } finally {
      window.removeEventListener('keydown', listen);
    }
    expect(heard).toEqual(['z', 'y']);
  });

  it("opens the canvas's element menu for a chart from a right-click, at the pointer, or from Chart Options", () => {
    elements = [chart('c')];
    mount();
    fireEvent.contextMenu(box('c'), { clientX: 120, clientY: 80 });
    expect(openElementMenu).toHaveBeenCalledTimes(1);
    const [id, at] = openElementMenu.mock.calls[0]!;
    expect(id).toBe('c');
    expect([at.left, at.bottom + 4]).toEqual([120, 80]);
    // Right-clicked, it is selected: its corner buttons show, Chart Options among them.
    fireEvent.click(screen.getByRole('button', { name: 'Chart Options' }));
    expect(openElementMenu).toHaveBeenCalledTimes(2);
    expect(openElementMenu.mock.calls[1]![0]).toBe('c');
    expect(bridge.commitElements).not.toHaveBeenCalled();
  });

  // share-roles.md: shaping the Sheet is an Editor's; a Participant writes cells only, a Viewer reads.
  it.each([
    ['a Participant', { canShape: false }],
    ['a Viewer', { canShape: false, interactive: false }],
    ['another tab in a Dashboard slot', { editable: false }],
  ])('is only looked at by %s', (_who, opts) => {
    elements = [chart('c')];
    mount(opts);
    const el = box('c');
    expect(el.getAttribute('role')).toBe('img');
    expect(el.className).not.toContain('pointer-events-auto');
    drag(el, 30, 30);
    fireEvent.keyDown(el, { key: 'Delete' });
    expect(bridge.commitElements).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Delete Chart' })).toBeNull();
    fireEvent.contextMenu(el);
    expect(openElementMenu).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Chart Options' })).toBeNull();
    expect(screen.getByTestId('drawn-c')).toBeTruthy();
  });

  describe("drawn by the canvas's own element view", () => {
    // A stand-in for the canvas view: its own gestures (which would drag or select it on the canvas) and an
    // indicator, as BoxedElementView draws them.
    const viewDown = vi.fn();
    const viewMenu = vi.fn();
    const openComments = vi.fn();
    const renderChart = vi.fn<SheetChartRenderer>((el, interactive) => (
      <div
        data-element-id={el.id}
        data-interactive={String(interactive)}
        onPointerDown={viewDown}
        onContextMenu={viewMenu}
      >
        <svg>
          <path data-testid="slice" />
        </svg>
        <div data-indicators="top">
          <button type="button" onClick={openComments}>
            1 comment
          </button>
        </div>
      </div>
    ));
    beforeEach(() => {
      viewDown.mockClear();
      viewMenu.mockClear();
      openComments.mockClear();
      renderChart.mockClear();
    });

    it('draws the chart through it, with its own look: no card, only a ring when selected', () => {
      elements = [chart('c')];
      mount({ renderChart });
      expect(renderChart).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), true);
      expect(screen.queryByTestId('drawn-c')).toBeNull();
      expect(box('c').style.backgroundColor).toBe('');
      expect(box('c').style.outline).toBe('');
      fireEvent.focus(box('c'));
      expect(box('c').style.outline).toMatch(/2px solid/);
    });

    it("tells it when the chart is another tab's, drawn there without its indicators", () => {
      elements = [chart('c')];
      mount({ renderChart, editable: false });
      expect(renderChart).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), false);
    });

    it("keeps the view's canvas gestures out: a press on the chart drags it in the Sheet", () => {
      elements = [chart('c')];
      mount({ renderChart });
      const slice = screen.getByTestId('slice');
      fireEvent.pointerDown(slice, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
      act(() => {
        box('c').dispatchEvent(
          new MouseEvent('pointermove', { clientX: 40, clientY: 30, bubbles: true }),
        );
      });
      act(() => {
        box('c').dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      });
      expect(viewDown).not.toHaveBeenCalled();
      expect(bridge.commitElements).toHaveBeenCalledTimes(1);
      expect((elements[0] as ShapeElement).sheetAnchor).toEqual({ x: 130, y: 70 });
    });

    it("opens the element menu from a right-click on the chart, never the view's own", () => {
      elements = [chart('c')];
      mount({ renderChart });
      fireEvent.contextMenu(screen.getByTestId('slice'), { clientX: 120, clientY: 80 });
      expect(openElementMenu).toHaveBeenCalledTimes(1);
      expect(viewMenu).not.toHaveBeenCalled();
    });

    it('leaves a press on its indicators to them', () => {
      elements = [chart('c')];
      mount({ renderChart });
      const badge = screen.getByRole('button', { name: '1 comment' });
      fireEvent.pointerDown(badge, { button: 0, pointerId: 1 });
      fireEvent.click(badge);
      expect(openComments).toHaveBeenCalledTimes(1);
      expect(viewDown).toHaveBeenCalledTimes(1);
      expect(bridge.commitElements).not.toHaveBeenCalled();
    });
  });
});
