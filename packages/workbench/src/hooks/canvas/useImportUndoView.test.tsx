// @vitest-environment jsdom

// Each editor's docs/specs/008-canvas/canvas-and-palette.md "Undoing an import brings its view back" (Work Tracker
// 1247): the hook over a stand-in history (a stack of tab lists) and the real view store. Each editor's own test drives
// it through its real history and import.

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createViewportStore } from '../../lib/viewport-store';
import type { ImportViewTab } from '../../lib/import-undo-view';
import { useImportUndoView } from './useImportUndoView';

const tab = (id: string, ids: string[]): ImportViewTab => ({
  id,
  elements: ids.map((e) => ({ id: e })),
});
const START = [tab('t1', ['old']), tab('t2', ['other'])];

function setup(activeId = 't1') {
  const viewport = createViewportStore(1);
  const land = vi.fn();
  const { result } = renderHook(() => {
    const [history, setHistory] = useState({
      past: [] as ImportViewTab[][],
      present: START,
      future: [] as ImportViewTab[][],
    });
    const view = useImportUndoView({ tabs: history.present, activeId, viewport, land });
    const commit = (next: ImportViewTab[]) =>
      setHistory((h) => ({ past: [...h.past, h.present], present: next, future: [] }));
    const undo = () =>
      setHistory((h) => ({
        past: h.past.slice(0, -1),
        present: h.past.at(-1)!,
        future: [h.present, ...h.future],
      }));
    const redo = () =>
      setHistory((h) => ({
        past: [...h.past, h.present],
        present: h.future[0]!,
        future: h.future.slice(1),
      }));
    return { history, view, commit, undo, redo };
  });
  const step = (which: 'undo' | 'redo') =>
    act(() => {
      result.current.view.beforeStep();
      result.current[which]();
    });
  // An import into t1: noted at the view it starts from, committed, then framed far away (as the editor's fit does).
  const importInto = () =>
    act(() => {
      result.current.view.noteImport('t1', [{ id: 'i1' }, { id: 'i2' }]);
      result.current.commit([tab('t1', ['i1', 'i2']), tab('t2', ['other'])]);
      viewport.setZoom(0.4);
      viewport.setOffset({ x: 900, y: 900 });
    });
  return { result, viewport, land, step, importInto };
}

describe('useImportUndoView', () => {
  it('puts the view back to where it was before the import when the import is undone', () => {
    const { viewport, step, importInto } = setup();
    act(() => {
      viewport.setZoom(1.5);
      viewport.setOffset({ x: -40, y: 12 });
    });
    importInto();
    step('undo');
    expect(viewport.get()).toEqual({ zoom: 1.5, offset: { x: -40, y: 12 } });
  });

  it('lands on the import again when it is redone', () => {
    const { land, step, importInto } = setup();
    importInto();
    step('undo');
    step('redo');
    expect(land).toHaveBeenCalledOnce();
  });

  it('leaves the view alone for an undo of a later edit, and for any undo before an import', () => {
    const { result, viewport, land, step, importInto } = setup();
    act(() => result.current.commit([tab('t1', ['old', 'x']), tab('t2', ['other'])]));
    step('undo');
    expect(viewport.get()).toEqual({ zoom: 1, offset: { x: 0, y: 0 } });
    importInto();
    act(() => result.current.commit([tab('t1', ['i1', 'i2', 'later']), tab('t2', ['other'])]));
    const view = viewport.get();
    step('undo');
    expect(viewport.get()).toEqual(view);
    expect(land).not.toHaveBeenCalled();
  });

  it("leaves another tab's view alone when the undone import was on t1", () => {
    const { viewport, land, step, importInto } = setup('t2');
    importInto();
    const view = viewport.get();
    step('undo');
    expect(viewport.get()).toEqual(view);
    expect(land).not.toHaveBeenCalled();
  });

  it('waits for the step to render before it looks', () => {
    const { result, viewport, importInto } = setup();
    importInto();
    const view = viewport.get();
    // A step announced but not taken changes nothing.
    act(() => result.current.view.beforeStep());
    expect(viewport.get()).toEqual(view);
  });
});
