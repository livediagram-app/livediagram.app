// The editor's own list row after a save (docs/specs/006-document/document-snapshots.md): it says
// `empty` the way the server list will, judged only from a first tab the editor really holds.

import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { emptyAfterSave } from './list-row-empty';

const tab = (id: string, n: number) =>
  ({
    id,
    name: id,
    elements: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })),
  }) as unknown as Tab;

describe('emptyAfterSave', () => {
  it('reads a loaded first tab', () => {
    expect(emptyAfterSave([tab('a', 0), tab('b', 2)], new Set(['a', 'b']), false)).toBe(true);
    expect(emptyAfterSave([tab('a', 1)], new Set(['a']), true)).toBe(false);
  });

  it('keeps what the list said when the first tab is an unloaded placeholder', () => {
    expect(emptyAfterSave([tab('a', 0)], new Set(), false)).toBe(false);
    expect(emptyAfterSave([tab('a', 0)], new Set(), true)).toBe(true);
    expect(emptyAfterSave([tab('a', 0)], new Set(), undefined)).toBeUndefined();
  });

  it('calls a document with no tab empty', () => {
    expect(emptyAfterSave([], new Set(), false)).toBe(true);
  });
});
