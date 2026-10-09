import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { sheetsDeletedWith } from './sheet-references';

// Which sheets a delete takes with its elements (docs/specs/029-sheets/sheet-store.md "Deleting a sheet").

const sheet = (id: string, sheetId: string, copyOf?: string) =>
  ({
    id,
    type: 'shape',
    shape: 'plan-sheet',
    planSheet: { sheetId, ...(copyOf ? { copyOf } : {}) },
  }) as unknown as Element;
const rect = { id: 'r1', type: 'shape', shape: 'rect' } as unknown as Element;
const tab = (id: string, elements: Element[]) => ({ id, name: id, elements }) as Tab;
const ids = (...xs: string[]) => new Set(xs);

describe('sheetsDeletedWith', () => {
  it('takes the sheet of a deleted Sheet nothing else references', () => {
    const tabs = [tab('t1', [sheet('e1', 'A'), rect])];
    expect(sheetsDeletedWith(tabs, 't1', ids('e1', 'r1'))).toEqual(['A']);
  });

  it('takes nothing when no Sheet is deleted', () => {
    expect(sheetsDeletedWith([tab('t1', [rect])], 't1', ids('r1'))).toEqual([]);
    expect(sheetsDeletedWith([], 't1', ids('e1'))).toEqual([]);
  });

  it('keeps a sheet another Sheet shows, on this tab or another', () => {
    expect(
      sheetsDeletedWith([tab('t1', [sheet('e1', 'A'), sheet('e2', 'A')])], 't1', ids('e1')),
    ).toEqual([]);
    expect(
      sheetsDeletedWith(
        [tab('t1', [sheet('e1', 'A')]), tab('t2', [sheet('e9', 'A')])],
        't1',
        ids('e1'),
      ),
    ).toEqual([]);
  });

  it('keeps a sheet a copy not yet made still needs (a duplicate, a duplicated tab)', () => {
    const tabs = [tab('t1', [sheet('e1', 'A')]), tab('t2', [sheet('e2', 'B', 'A')])];
    expect(sheetsDeletedWith(tabs, 't1', ids('e1'))).toEqual([]);
  });

  it('takes a sheet when every element referencing it goes in the same delete', () => {
    const tabs = [tab('t1', [sheet('e1', 'A'), sheet('e2', 'A'), sheet('e3', 'B', 'A')])];
    expect(sheetsDeletedWith(tabs, 't1', ids('e1', 'e2', 'e3'))).toEqual(['A']);
  });

  it('takes nothing for a deleted copy not yet made: it has no sheet', () => {
    const tabs = [tab('t1', [sheet('e1', 'A'), sheet('e2', 'B', 'A')])];
    expect(sheetsDeletedWith(tabs, 't1', ids('e2'))).toEqual([]);
  });

  it('only looks at the open tab’s elements for what is deleted', () => {
    const tabs = [tab('t1', [rect]), tab('t2', [sheet('e1', 'A')])];
    expect(sheetsDeletedWith(tabs, 't1', ids('e1'))).toEqual([]);
  });
});
