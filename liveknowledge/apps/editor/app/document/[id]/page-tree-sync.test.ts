import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveknowledge/document';
import type { TabSummary } from '@liveknowledge/api-schema';
import { computeTabSaveDiff, placeholdersFromSummaries } from './editor-page-helpers';
import { applyRoomOpToTabs } from './room-op-apply';
import { applyTabList, tabListOf } from './resync-tab-list';

// The page tree between the api, the save and peers (docs/specs/030-knowledgebase/blueprints/page-tree.md
// "Storage"): the tree draws from the summaries alone, a page moved before its body ever loaded is still saved, and
// a peer's list places a page whether it holds the body or not.

const tab = (id: string, parent?: string): Tab => ({
  id,
  name: id,
  elements: [],
  ...(parent ? { parent } : {}),
});
const summary = (id: string, i: number, parent?: string): TabSummary => ({
  id,
  documentId: 'D',
  name: id,
  orderIndex: i,
  updatedAt: 0,
  ...(parent ? { parent } : {}),
});

describe('placeholdersFromSummaries', () => {
  it('carries each page’s parent, and none at the top level', () => {
    const tabs = placeholdersFromSummaries([summary('a', 0), summary('b', 1, 'a')]);
    expect(tabs.map((t) => t.parent)).toEqual([undefined, 'a']);
    expect(Object.hasOwn(tabs[0]!, 'parent')).toBe(false);
  });
});

describe('computeTabSaveDiff', () => {
  it('saves the list when a page that was never loaded moves under another', () => {
    const saved = [tab('a'), tab('b')];
    const moved = [saved[0]!, tab('b', 'a')];
    const diff = computeTabSaveDiff(saved, moved, 'K', 'K', new Set(['a']));
    // The body is not held here, so it is not saved; the list, which carries the parent, is.
    expect(diff.changedTabs).toEqual([]);
    expect(diff.orderChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
  });

  it('saves nothing when no page moved', () => {
    const saved = [tab('a'), tab('b', 'a')];
    expect(computeTabSaveDiff(saved, [...saved], 'K', 'K', new Set()).hasChanges).toBe(false);
  });
});

describe('a peer’s tab list', () => {
  const list = (entries: { id: string; parent?: string | null }[]) => ({
    kind: 'document-meta' as const,
    name: 'K',
    tabs: entries.map((e, i) => ({ ...e, name: e.id, orderIndex: i })),
  });

  it('places a page under its new parent, loaded or not, and out to the top level', () => {
    const tabs = [tab('a'), tab('b'), tab('c', 'a')];
    const next = applyRoomOpToTabs(
      tabs,
      list([
        { id: 'a', parent: null },
        { id: 'b', parent: 'a' },
        { id: 'c', parent: null },
      ]),
    );
    expect(next.map((t) => [t.id, t.parent])).toEqual([
      ['a', undefined],
      ['b', 'a'],
      ['c', undefined],
    ]);
    // An unmoved page is the same object: the autosave keys off identity.
    expect(next[0]).toBe(tabs[0]);
    expect(Object.hasOwn(next[2]!, 'parent')).toBe(false);
  });

  it('leaves the tree alone when the list carries no parent (the room’s rename relay)', () => {
    const tabs = [tab('a'), tab('b', 'a')];
    const next = applyRoomOpToTabs(tabs, list([{ id: 'a' }, { id: 'b' }]));
    expect(next[1]).toBe(tabs[1]);
  });

  it('brings a new page in under its parent', () => {
    const next = applyRoomOpToTabs([tab('a')], list([{ id: 'a' }, { id: 'n', parent: 'a' }]));
    expect(next[1]).toMatchObject({ id: 'n', parent: 'a', elements: [] });
  });

  it('ignores a parent that is no id', () => {
    const tabs = [tab('a'), tab('b', 'a')];
    const next = applyRoomOpToTabs(tabs, {
      ...list([{ id: 'a' }]),
      tabs: [
        { id: 'a', name: 'a', orderIndex: 0 },
        { id: 'b', name: 'b', orderIndex: 1, parent: 7 as unknown as string },
      ],
    });
    expect(next[1]!.parent).toBeUndefined();
  });
});

describe('a resync’s tab list', () => {
  it('reads the stored tree back, so a move missed while offline lands', () => {
    const stored = { name: 'K', tabs: [summary('a', 0), summary('b', 1, 'a'), summary('c', 2)] };
    const op = tabListOf(stored)!;
    expect(op.tabs.map((t) => t.parent)).toEqual([null, 'a', null]);
    const held = [tab('a'), tab('b'), tab('c', 'a')];
    const next = applyTabList(held, op, new Set(['a']));
    expect(next.map((t) => t.parent)).toEqual([undefined, 'a', undefined]);
  });
});
