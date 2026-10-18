// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement, Tab } from '@livediagram/document';
import { sheetsLeftOutMessage, useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/029-sheets/sheet.md "Only in Plan": a paste onto a tab not in Plan leaves out its Sheets and says so;
// a tab in Plan takes them.

const note: StickyElement = {
  id: 'note',
  type: 'sticky',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  label: 'Order placed',
};
const sheet = {
  id: 'sheet',
  type: 'shape',
  shape: 'plan-sheet',
  x: 300,
  y: 0,
  width: 960,
  height: 560,
  planSheet: { sheetId: 'sheetAAAAAAAA' },
} as Element;

function harness(tab: Partial<Tab>) {
  let elements: Element[] = [];
  const toast = { error: vi.fn(), info: vi.fn() };
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: false,
      embedMode: false,
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Tab', ...tab, elements },
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      ownerId: 'me',
      documentId: 'd',
      toast: toast as never,
    }),
  );
  const shapes = () => elements.map((el) => (el.type === 'shape' ? el.shape : el.type));
  return { result, shapes, toast };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('pasting a Sheet', () => {
  it('leaves it out on a tab in Diagram, pastes the rest, and says so', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const h = harness({});
    act(() => h.result.current.pasteFromClipboard([note, sheet]));
    expect(h.shapes()).toEqual(['sticky']);
    expect(h.toast.info).toHaveBeenCalledWith(
      'Sheets stay on Plan tabs, so the sheet was left out',
    );
    expect(log).toHaveBeenCalledWith('[clipboard] sheets left out', { sheets: 1 });
  });

  it('pastes nothing when the Sheet was all it held, still saying so', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const h = harness({ opensIn: 'draw' });
    act(() => h.result.current.pasteFromClipboard([sheet]));
    expect(h.shapes()).toEqual([]);
    expect(h.toast.info).toHaveBeenCalledTimes(1);
  });

  it('pastes it on a tab in Plan', () => {
    const h = harness({ opensIn: 'plan' });
    act(() => h.result.current.pasteFromClipboard([note, sheet]));
    expect(h.shapes()).toEqual(['sticky', 'plan-sheet']);
    expect(h.toast.info).not.toHaveBeenCalled();
  });

  it('pastes as before when there is no Sheet', () => {
    const h = harness({});
    act(() => h.result.current.pasteFromClipboard([note]));
    expect(h.shapes()).toEqual(['sticky']);
    expect(h.toast.info).not.toHaveBeenCalled();
  });

  it('counts the sheets it left out', () => {
    expect(sheetsLeftOutMessage(2)).toBe('Sheets stay on Plan tabs, so the sheets were left out');
  });
});
