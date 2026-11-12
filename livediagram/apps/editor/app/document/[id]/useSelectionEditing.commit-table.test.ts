// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTable, type Element, type Tab, type TableElement } from '@livediagram/document';
import { historyCommit, historyUndo, type History } from '@/hooks/canvas/useDocumentHistory';
import { useSelectionEditing } from './useSelectionEditing';

// docs/specs/009-elements/table-rows-fit-text.md: a cell commit grows its row to fit the words, in the same commit.

function setup(el: Element) {
  let elements: Element[] = [el];
  let commits = 0;
  const tab = { id: 't', name: 'Tab 1', elements } as Tab;
  const { result } = renderHook(() =>
    useSelectionEditing({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set() }) as never,
      isReadOnly: false,
      tabLocked: false,
      layerInertIds: new Set(),
      adoptLayerName: vi.fn(),
      formatSourceId: null,
      formatToolActive: false,
      documentName: 'Doc',
      tabs: [tab],
      activeTab: tab,
      drawMode: false,
      editingId: null,
      commit: (fn) => {
        commits++;
        elements = fn(elements);
      },
      discardLastStep: vi.fn(),
      tickTabs: vi.fn(),
      applyFormatFromSource: vi.fn(),
      lockedByOther: () => false,
      set: {
        setFormatSourceId: vi.fn(),
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        setEditCursorAtEnd: vi.fn(),
        setMultiSelectedIds: vi.fn(),
        setDocumentName: vi.fn(),
        setContextMenu: vi.fn(),
      },
    }),
  );
  return {
    editing: result.current,
    table: () => elements[0] as TableElement,
    commits: () => commits,
  };
}

describe('commitTable', () => {
  const base = createTable(40, 60);
  const withCell = (text: string) =>
    base.cells.map((row, r) => (r === 1 ? [text, ...row.slice(1)] : row));

  it('grows the row a long cell needs, top kept, in the one commit', () => {
    const s = setup(base);
    const long = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n');
    s.editing.commitTable(base.id, { cells: withCell(long) });
    const t = s.table();
    expect(s.commits()).toBe(1);
    expect(t.cells[1]![0]).toBe(long);
    expect(t.y).toBe(60);
    expect(t.height).toBeGreaterThan(150);
    expect(t.rowHeights?.[0]).toBeNull();
    expect(t.rowHeights?.[1]).toBeGreaterThan(50);
    expect(t.height - (t.rowHeights?.[1] ?? 0)).toBeCloseTo(100, 5);
  });

  it('leaves the size alone when the words fit, and for a patch without cells', () => {
    const s = setup(base);
    s.editing.commitTable(base.id, { cells: withCell('Short') });
    expect(s.table()).toMatchObject({ height: 150 });
    expect(s.table().rowHeights).toBeUndefined();
    s.editing.commitTable(base.id, { colWidths: [100, null, null] });
    expect(s.table()).toMatchObject({ height: 150, colWidths: [100, null, null] });
  });

  it('never shrinks a grown row when its words are taken away', () => {
    const s = setup({ ...base, height: 300, rowHeights: [null, 200, null] });
    s.editing.commitTable(base.id, { cells: withCell('') });
    expect(s.table()).toMatchObject({ height: 300, rowHeights: [null, 200, null] });
  });

  it('grows a row when a cell style makes its words need more room', () => {
    const cells = withCell('one two three four');
    const s = setup({ ...base, cells });
    s.editing.commitTable(base.id, {
      cellStyles: [[], [{ textSize: 40 }], []],
    });
    expect(s.table().height).toBeGreaterThan(150);
  });
});

// docs/specs/009-elements/table-rows-fit-text.md "One step per edit": the commits a cell edit makes go through the
// real history, and a commit that writes what the table holds is no step.
describe('commitTable undo steps', () => {
  const base = createTable(40, 60);
  const withCell = (text: string) =>
    base.cells.map((row, r) => (r === 1 ? [text, ...row.slice(1)] : row));

  function historySetup() {
    const tab: Tab = { id: 't', name: 'Tab 1', elements: [base] };
    let h: History = { past: [], present: [tab], future: [] };
    const { result } = renderHook(() =>
      useSelectionEditing({
        readSelection: () => ({ selectedId: null, multiSelectedIds: new Set() }) as never,
        isReadOnly: false,
        tabLocked: false,
        layerInertIds: new Set(),
        adoptLayerName: vi.fn(),
        formatSourceId: null,
        formatToolActive: false,
        documentName: 'Doc',
        tabs: [tab],
        activeTab: tab,
        drawMode: false,
        editingId: null,
        commit: (fn) => {
          h = historyCommit(h, (tabs) => tabs.map((t) => ({ ...t, elements: fn(t.elements) })));
        },
        discardLastStep: vi.fn(),
        tickTabs: vi.fn(),
        applyFormatFromSource: vi.fn(),
        lockedByOther: () => false,
        set: {
          setFormatSourceId: vi.fn(),
          setSelectedId: vi.fn(),
          setEditingId: vi.fn(),
          setEditCursorAtEnd: vi.fn(),
          setMultiSelectedIds: vi.fn(),
          setDocumentName: vi.fn(),
          setContextMenu: vi.fn(),
        },
      }),
    );
    const table = () => h.present[0]!.elements[0] as TableElement;
    return {
      editing: result.current,
      history: () => h,
      undo: () => {
        h = historyUndo(h);
      },
      table,
      cell: () => table().cells[1]![0],
    };
  }

  it('takes one undo per cell edit when Escape commits and the blur commits the same text again', () => {
    const s = historySetup();
    const long = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n');
    s.editing.commitTable(base.id, { cells: withCell(long) }); // Escape
    s.editing.commitTable(base.id, { cells: withCell(long) }); // the blur that follows
    s.editing.commitTable(base.id, { cells: withCell('Second') }); // the next edit
    s.editing.commitTable(base.id, { cells: withCell('Second') });
    expect(s.history().past).toHaveLength(2);
    s.undo();
    expect(s.cell()).toBe(long);
    expect(s.table().height).toBeGreaterThan(150);
    s.undo();
    expect(s.cell()).toBe(base.cells[1]![0]);
    expect(s.table().height).toBe(base.height);
    expect(s.history().past).toHaveLength(0);
  });

  it('pushes no step for a cell opened and left untouched, and keeps the redo side', () => {
    const s = historySetup();
    s.editing.commitTable(base.id, { cells: withCell('Typed') });
    s.undo();
    expect(s.history().future).toHaveLength(1);
    s.editing.commitTable(base.id, { cells: base.cells.map((row) => [...row]) });
    expect(s.history().past).toHaveLength(0);
    expect(s.history().future).toHaveLength(1);
  });

  it('still steps when only a parallel array changes', () => {
    const s = historySetup();
    s.editing.commitTable(base.id, {
      cells: base.cells.map((row) => [...row]),
      colWidths: [90, null, null],
    });
    expect(s.history().past).toHaveLength(1);
  });
});
