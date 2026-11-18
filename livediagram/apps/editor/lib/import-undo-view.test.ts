import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { importViewMove, type ImportViewMark } from './import-undo-view';

// docs/specs/008-canvas/canvas-and-palette.md "Undoing an import brings its view back".

const el = (id: string) => ({ id }) as Element;
const tab = (id: string, ids: string[]): Tab => ({ id, name: id, elements: ids.map(el) });
const mark: ImportViewMark = {
  tabId: 't1',
  ids: new Set(['i1', 'i2']),
  before: { zoom: 1, offset: { x: 0, y: 0 } },
};
const withImport = [tab('t1', ['i1', 'i2']), tab('t2', ['x'])];
const withoutImport = [tab('t1', ['old']), tab('t2', ['x'])];

describe('importViewMove', () => {
  it('restores the view when the step takes the import away', () => {
    expect(importViewMove(mark, withImport, withoutImport, 't1')).toBe('restore');
  });

  it('lands again when the step brings the import back', () => {
    expect(importViewMove(mark, withoutImport, withImport, 't1')).toBe('land');
  });

  it('leaves the view when the import stays, or stays away', () => {
    const edited = [tab('t1', ['i1', 'i2', 'new']), tab('t2', ['x'])];
    expect(importViewMove(mark, edited, withImport, 't1')).toBeNull();
    expect(importViewMove(mark, withoutImport, withoutImport, 't1')).toBeNull();
  });

  it('counts the import as there while any of its elements is', () => {
    const partly = [tab('t1', ['i2']), tab('t2', ['x'])];
    expect(importViewMove(mark, partly, withoutImport, 't1')).toBe('restore');
  });

  it('never moves the view without a mark, an empty one, or off the import tab', () => {
    expect(importViewMove(null, withImport, withoutImport, 't1')).toBeNull();
    expect(importViewMove({ ...mark, ids: new Set() }, withImport, withoutImport, 't1')).toBeNull();
    expect(importViewMove(mark, withImport, withoutImport, 't2')).toBeNull();
  });

  it('treats a tab the step removed as holding nothing', () => {
    expect(importViewMove(mark, withImport, [tab('t2', ['x'])], 't1')).toBe('restore');
  });
});
