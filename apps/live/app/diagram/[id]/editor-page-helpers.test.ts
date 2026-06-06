import type { Tab } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import {
  computeTabSaveDiff,
  createTab,
  patchTab,
  placeholdersFromSummaries,
  pruneMapToPresent,
  resolveDiagramSession,
} from './editor-page-helpers';

function tab(id: string, name = id, elements: Tab['elements'] = []): Tab {
  return { id, name, elements };
}

describe('createTab', () => {
  it('mints a tab with a fresh id, the given name, and no elements', () => {
    const t = createTab('Tab 1');
    expect(t.name).toBe('Tab 1');
    expect(t.elements).toEqual([]);
    expect(typeof t.id).toBe('string');
    expect(t.id.length).toBeGreaterThan(0);
  });
});

describe('placeholdersFromSummaries', () => {
  it('materialises a fresh Tab 1 when the API returns zero summaries (never empty)', () => {
    // An empty tabs array makes activeTab undefined and crashes the
    // editor on first elements read, so this guard is load-bearing.
    const out = placeholdersFromSummaries([]);
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe('Tab 1');
    expect(out[0]!.elements).toEqual([]);
  });

  it('maps summaries to empty-element placeholder tabs preserving id + name + order', () => {
    const out = placeholdersFromSummaries([
      { id: 'a', name: 'Overview' },
      { id: 'b', name: 'Backend' },
    ]);
    expect(out.map((t) => [t.id, t.name])).toEqual([
      ['a', 'Overview'],
      ['b', 'Backend'],
    ]);
    expect(out.every((t) => t.elements.length === 0)).toBe(true);
  });
});

describe('patchTab', () => {
  it('patches the matching tab and returns NON-matching tabs by reference', () => {
    const a = tab('a');
    const b = tab('b');
    const out = patchTab([a, b], 'a', { name: 'Renamed' });
    expect(out[0]).toEqual({ ...a, name: 'Renamed' });
    // Identity preservation is load-bearing: the autosave diff compares
    // tabs by reference, so an untouched tab must keep its identity.
    expect(out[1]).toBe(b);
  });

  it('is a no-op clone when no id matches', () => {
    const a = tab('a');
    const out = patchTab([a], 'zzz', { name: 'x' });
    expect(out[0]).toBe(a);
  });
});

describe('computeTabSaveDiff (autosave decision kernel)', () => {
  it('reports no changes when prev === current (stable references, same name)', () => {
    const tabs = [tab('a'), tab('b')];
    const diff = computeTabSaveDiff(tabs, tabs, 'Doc', 'Doc');
    expect(diff.hasChanges).toBe(false);
    expect(diff.changedTabs).toEqual([]);
    expect(diff.deletedIds).toEqual([]);
    expect(diff.orderChanged).toBe(false);
    expect(diff.nameChanged).toBe(false);
  });

  it('flags a content-changed tab by identity (new reference), skipping untouched ones', () => {
    const a = tab('a');
    const b = tab('b');
    const aEdited = { ...a, elements: [...a.elements] }; // new reference for a
    const diff = computeTabSaveDiff([a, b], [aEdited, b], 'Doc', 'Doc');
    expect(diff.changedTabs.map((t) => t.id)).toEqual(['a']);
    expect(diff.hasChanges).toBe(true);
    expect(diff.orderChanged).toBe(false);
  });

  it('flags a diagram rename via nameChanged', () => {
    const tabs = [tab('a')];
    const diff = computeTabSaveDiff(tabs, tabs, 'Old', 'New');
    expect(diff.nameChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
    expect(diff.changedTabs).toEqual([]);
  });

  it('flags an added tab as orderChanged (length differs)', () => {
    const a = tab('a');
    const diff = computeTabSaveDiff([a], [a, tab('b')], 'Doc', 'Doc');
    expect(diff.orderChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
    expect(diff.deletedIds).toEqual([]);
  });

  it('reports a removed tab in deletedIds (and orderChanged)', () => {
    const a = tab('a');
    const b = tab('b');
    const diff = computeTabSaveDiff([a, b], [a], 'Doc', 'Doc');
    expect(diff.deletedIds).toEqual(['b']);
    expect(diff.orderChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
  });

  it('flags a pure reorder as orderChanged with no changed/deleted tabs', () => {
    const a = tab('a');
    const b = tab('b');
    const diff = computeTabSaveDiff([a, b], [b, a], 'Doc', 'Doc');
    expect(diff.orderChanged).toBe(true);
    expect(diff.changedTabs).toEqual([]);
    expect(diff.deletedIds).toEqual([]);
    expect(diff.hasChanges).toBe(true);
  });

  it('combines edits, deletes, reorders, and a rename in one diff', () => {
    const a = tab('a');
    const b = tab('b');
    const c = tab('c');
    const cEdited = { ...c, name: 'C2' };
    // start [a,b,c] "Doc" -> end [c-edited, a] "Doc2": b deleted, c
    // edited + moved to front, a moved back, name changed.
    const diff = computeTabSaveDiff([a, b, c], [cEdited, a], 'Doc', 'Doc2');
    expect(diff.changedTabs.map((t) => t.id)).toEqual(['c']);
    expect(diff.deletedIds).toEqual(['b']);
    expect(diff.orderChanged).toBe(true);
    expect(diff.nameChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
  });
});

describe('resolveDiagramSession (owner / role / share-code security)', () => {
  it('owner: always edit, no share code, can edit the log — even when arriving via a share URL', () => {
    const s = resolveDiagramSession({
      diagramOwnerId: 'me',
      selfId: 'me',
      shareRole: 'view', // a stale view code on the owner's own URL must not downgrade them
      shareCodeParam: 'CODE2345',
    });
    expect(s.isOwner).toBe(true);
    expect(s.sessionRole).toBe('edit');
    expect(s.sessionShareCode).toBeNull();
    expect(s.canEditLog).toBe(true);
  });

  it('edit-role visitor: inherits edit, carries their code, can edit the log', () => {
    const s = resolveDiagramSession({
      diagramOwnerId: 'someone-else',
      selfId: 'me',
      shareRole: 'edit',
      shareCodeParam: 'CODE2345',
    });
    expect(s.isOwner).toBe(false);
    expect(s.sessionRole).toBe('edit');
    expect(s.sessionShareCode).toBe('CODE2345');
    expect(s.canEditLog).toBe(true);
  });

  it('view-role visitor: stays view, carries their code, CANNOT edit the log', () => {
    const s = resolveDiagramSession({
      diagramOwnerId: 'someone-else',
      selfId: 'me',
      shareRole: 'view',
      shareCodeParam: 'CODE2345',
    });
    expect(s.isOwner).toBe(false);
    expect(s.sessionRole).toBe('view');
    expect(s.sessionShareCode).toBe('CODE2345');
    expect(s.canEditLog).toBe(false);
  });
});

describe('pruneMapToPresent (realtime presence cleanup)', () => {
  it('drops entries whose participant left, keeping the present ones', () => {
    const prev = new Map([
      ['ann', 't1'],
      ['bob', 't2'],
      ['cat', 't3'],
    ]);
    const out = pruneMapToPresent(prev, new Set(['ann', 'cat']));
    expect([...out.entries()]).toEqual([
      ['ann', 't1'],
      ['cat', 't3'],
    ]);
  });

  it('returns the SAME reference when nothing was removed (identity preserved for memo)', () => {
    // Load-bearing: a fresh Map on every presence ping would re-render
    // every presence consumer even when the roster is unchanged.
    const prev = new Map([
      ['ann', 't1'],
      ['bob', 't2'],
    ]);
    expect(pruneMapToPresent(prev, new Set(['ann', 'bob']))).toBe(prev);
    // A superset of present ids also counts as "nothing removed".
    expect(pruneMapToPresent(prev, new Set(['ann', 'bob', 'zoe']))).toBe(prev);
  });

  it('returns a new empty map when everyone left', () => {
    const prev = new Map([['ann', 't1']]);
    const out = pruneMapToPresent(prev, new Set<string>());
    expect(out).not.toBe(prev);
    expect(out.size).toBe(0);
  });

  it('preserves null values (cursor/selection maps store null for "no position")', () => {
    const prev = new Map<string, string | null>([
      ['ann', null],
      ['bob', 'el-1'],
    ]);
    const out = pruneMapToPresent(prev, new Set(['ann']));
    expect([...out.entries()]).toEqual([['ann', null]]);
  });
});
