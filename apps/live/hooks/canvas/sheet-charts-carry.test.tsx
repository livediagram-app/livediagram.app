// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, ShapeElement, Tab } from '@livediagram/document';
import { useClipboard } from './useClipboard';
import { useElementDuplication } from './useElementDuplication';
import { useElementSelectionActions as buildSelectionActions } from './useElementSelectionActions';
import { useNudgeSelection } from './useNudgeSelection';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/029-sheets/sheet.md "Charts": a chart anchored in a Sheet is the Sheet's. The canvas never selects it,
// so every path that copies, deletes or moves the Sheet must take its charts along: a copy's charts read the
// Sheet's copy, a delete takes them in the same step, and a nudge moves them as a drag does.

const range = { r1: 'row0001', c1: 'col0001', r2: 'row0002', c2: 'col0002' };

const sheet = {
  id: 'sheet',
  type: 'shape',
  shape: 'plan-sheet',
  x: 0,
  y: 0,
  width: 600,
  height: 400,
  planSheet: { sheetId: 'sheet0001' },
} as unknown as Element;

const anchored = {
  id: 'anchored',
  type: 'shape',
  shape: 'bar-chart',
  x: 600,
  y: 0,
  width: 240,
  height: 160,
  chartSource: { sheetId: 'sheet0001', range },
  sheetAnchor: { x: 40, y: 40 },
} as unknown as Element;

// A floating chart over the canvas elsewhere: never part of the Sheet.
const floatingFar = {
  id: 'floating',
  type: 'shape',
  shape: 'bar-chart',
  x: 5000,
  y: 5000,
  width: 240,
  height: 160,
  chartSource: { sheetId: 'sheet0001', range },
} as unknown as Element;

const start = (): Element[] => [sheet, anchored, floatingFar];
const charts = (els: Element[]) =>
  els.filter((el): el is ShapeElement => el.type === 'shape' && el.shape === 'bar-chart');
const sheetCopy = (els: Element[]) =>
  els.find(
    (el): el is ShapeElement =>
      el.type === 'shape' && el.shape === 'plan-sheet' && el.id !== 'sheet',
  );

afterEach(() => cleanup());

describe('duplicating a Sheet', () => {
  function duplicate(selection: { selectedId: string | null; multi: string[] }) {
    let elements = start();
    const selected = vi.fn();
    const multi = vi.fn();
    const { result } = renderHook(() =>
      useElementDuplication({
        readSelection: () => ({
          selectedId: selection.selectedId,
          multiSelectedIds: new Set(selection.multi),
        }),
        activeTab: { id: 't', name: 'T', elements } as Tab,
        commit: (m) => {
          elements = m(elements);
        },
        setSelectedId: selected,
        setMultiSelectedIds: multi,
      }),
    );
    return { result, elements: () => elements, selected, multi };
  }

  it('Cmd+D on the Sheet alone copies its anchored chart, reading the copy, and selects the Sheet copy', () => {
    const h = duplicate({ selectedId: 'sheet', multi: [] });
    h.result.current.duplicateSelected();
    const copy = sheetCopy(h.elements())!;
    expect(copy).toBeDefined();
    const copiedCharts = charts(h.elements()).filter(
      (c) => !['anchored', 'floating'].includes(c.id),
    );
    expect(copiedCharts).toHaveLength(1);
    expect(copiedCharts[0]!.chartSource!.sheetId).toBe(copy.planSheet!.sheetId);
    expect(copiedCharts[0]!.sheetAnchor).toEqual({ x: 40, y: 40 });
    expect(h.selected).toHaveBeenCalledWith(copy.id);
  });

  it('Cmd+D on a multi-selection holding the Sheet copies its chart and selects only what the canvas draws', () => {
    const plain = {
      id: 'box',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 900,
      width: 10,
      height: 10,
    };
    let elements: Element[] = [...start(), plain as Element];
    const multi = vi.fn();
    const { result } = renderHook(() =>
      useElementDuplication({
        readSelection: () => ({ selectedId: null, multiSelectedIds: new Set(['sheet', 'box']) }),
        activeTab: { id: 't', name: 'T', elements } as Tab,
        commit: (m) => {
          elements = m(elements);
        },
        setSelectedId: vi.fn(),
        setMultiSelectedIds: multi,
      }),
    );
    result.current.duplicateMultiSelected();
    expect(elements).toHaveLength(7);
    const copy = sheetCopy(elements)!;
    const copiedChart = charts(elements).find((c) => !['anchored', 'floating'].includes(c.id))!;
    expect(copiedChart.chartSource!.sheetId).toBe(copy.planSheet!.sheetId);
    const picked = multi.mock.calls.at(-1)![0] as Set<string>;
    expect(picked.size).toBe(2);
    expect(picked.has(copiedChart.id)).toBe(false);
  });
});

describe('quick-add duplicating a Sheet', () => {
  it('copies its anchored chart, reading the copy', () => {
    let elements = start();
    const actions = buildSelectionActions({
      currentSelectionIds: () => new Set(['sheet']),
      readSelection: () => ({ selectedId: 'sheet', multiSelectedIds: new Set() }),
      activeTab: { id: 't', name: 'T', elements } as Tab,
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId: () => {},
      setEditingId: () => {},
      setMultiSelectedIds: () => {},
      setFormatSourceId: () => {},
      lockedByOther: () => false,
      layerLockedIds: new Set(),
      layerInertIds: new Set(),
    });
    actions.spawnConnectSelected('right', 'duplicate');
    const copy = sheetCopy(elements)!;
    const copiedChart = charts(elements).find((c) => !['anchored', 'floating'].includes(c.id))!;
    expect(copiedChart.chartSource!.sheetId).toBe(copy.planSheet!.sheetId);
  });
});

describe('deleting a Sheet', () => {
  it('takes its anchored chart in the same step, leaving a floating chart of it on the canvas', () => {
    let elements = start();
    let commits = 0;
    const actions = buildSelectionActions({
      currentSelectionIds: () => new Set(['sheet']),
      readSelection: () => ({ selectedId: 'sheet', multiSelectedIds: new Set() }),
      activeTab: { id: 't', name: 'T', elements } as Tab,
      commit: (m) => {
        commits += 1;
        elements = m(elements);
      },
      setSelectedId: () => {},
      setEditingId: () => {},
      setMultiSelectedIds: () => {},
      setFormatSourceId: () => {},
      lockedByOther: () => false,
      layerLockedIds: new Set(),
      layerInertIds: new Set(),
    });
    actions.deleteSelected();
    expect(commits).toBe(1);
    expect(elements.map((el) => el.id)).toEqual(['floating']);
  });
});

describe('nudging a Sheet', () => {
  it('moves its anchored chart with it', () => {
    let elements = start();
    const { result } = renderHook(() =>
      useNudgeSelection({
        isReadOnly: false,
        readSelection: () => ({ selectedId: 'sheet', multiSelectedIds: new Set() }),
        get activeTab() {
          return { id: 't', name: 'T', elements } as Tab;
        },
        laneBoard: false,
        markCheckpoint: () => {},
        tick: (m) => {
          elements = m(elements);
        },
        autoRebindArrowsRef: { current: false },
      }),
    );
    result.current(10, 0);
    const at = (id: string) => elements.find((el) => el.id === id) as ShapeElement;
    expect(at('sheet').x).toBe(10);
    expect(at('anchored').x).toBe(610);
    expect(at('floating').x).toBe(5000);
  });
});

describe('copying and pasting a Sheet', () => {
  let written = '';
  beforeEach(() => {
    written = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async (text: string) => {
          written = text;
        }),
      },
    });
  });

  it('carries its anchored chart, relinked to the pasted Sheet, and selects only the Sheet', async () => {
    let elements = start();
    const setSelectedId = vi.fn();
    const { result } = renderHook(() =>
      useClipboard({
        isReadOnly: false,
        embedMode: false,
        readSelection: () => ({ selectedId: 'sheet', multiSelectedIds: new Set() }),
        editingId: null,
        setEditingId: () => {},
        activeTab: { id: 't', name: 'Board', elements } as Tab,
        commit: (m) => {
          elements = m(elements);
        },
        setSelectedId,
        setMultiSelectedIds: () => {},
        ownerId: 'me',
        documentId: 'd',
        toast: { error: vi.fn(), info: vi.fn() } as never,
      }),
    );
    await act(async () => result.current.copySelection());
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => written, files: [], items: [] },
    });
    document.body.dispatchEvent(event);
    const copy = sheetCopy(elements)!;
    expect(copy).toBeDefined();
    const copiedChart = charts(elements).find((c) => !['anchored', 'floating'].includes(c.id))!;
    expect(copiedChart.chartSource!.sheetId).toBe(copy.planSheet!.sheetId);
    expect(setSelectedId).toHaveBeenLastCalledWith(copy.id);
  });
});
