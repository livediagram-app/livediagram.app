// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type Tab } from '@liveplanner/project';
import { ITEM_TYPES, type ItemTypeCatalogue, type ItemTypeDef } from '@liveplanner/items';
import { newJoinMemory, statusJoinsNow, useTypeStatusJoins } from './useTypeStatusJoins';

// docs/specs/026-plan/item-types.md "The statuses a type uses": a new status joins only the types its board takes
// (Work Tracker #54), and a legacy type is written in the new shape once every tab is read.

const board = (id: string, statuses: string[], addTypes?: string[]): Element => ({
  ...createShape('plan-board', 0, 0),
  id,
  planBoard: {
    title: id,
    columns: statuses.map((s) => ({ id: `c-${s}`, status: s, name: s })),
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    ...(addTypes ? { addTypes } : {}),
  },
});
const tab = (id: string, elements: Element[]) => ({ id, elements }) as unknown as Tab;
const IDS = ['bug', 'story'];

describe('statusJoinsNow', () => {
  it('seeds from the tabs the project started with, then joins a new board’s statuses to its types only', () => {
    const m = newJoinMemory();
    const bugs = tab('t1', [board('b1', ['new', 'doing', 'done'], ['bug'])]);
    expect(statusJoinsNow(m, [bugs], new Set(['t1']), IDS)).toEqual(new Map());
    const withStories = tab('t1', [
      ...bugs.elements,
      board('b2', ['backlog', 'doing', 'shipped'], ['story']),
    ]);
    expect(statusJoinsNow(m, [withStories], new Set(['t1']), IDS)).toEqual(
      new Map([['story', ['backlog', 'doing', 'shipped']]]),
    );
  });

  it('joins a column added, and never again a status the type had (a column put back)', () => {
    const m = newJoinMemory();
    const loaded = new Set(['t1']);
    statusJoinsNow(m, [tab('t1', [board('b', ['todo'])])], loaded, IDS);
    const added = statusJoinsNow(m, [tab('t1', [board('b', ['todo', 'qa'])])], loaded, IDS);
    expect(added).toEqual(
      new Map([
        ['bug', ['qa']],
        ['story', ['qa']],
      ]),
    );
    statusJoinsNow(m, [tab('t1', [board('b', ['todo'])])], loaded, IDS);
    expect(statusJoinsNow(m, [tab('t1', [board('b', ['todo', 'qa'])])], loaded, IDS)).toEqual(
      new Map(),
    );
  });

  it('seeds a start tab read later, but joins the boards of a tab made in the session', () => {
    const m = newJoinMemory();
    const later = tab('t2', [board('b2', ['x'], ['bug'])]);
    statusJoinsNow(m, [tab('t1', []), later], new Set(['t1']), IDS);
    expect(statusJoinsNow(m, [tab('t1', []), later], new Set(['t1', 't2']), IDS)).toEqual(
      new Map(),
    );
    const made = tab('t3', [board('b3', ['y'], ['bug'])]);
    expect(
      statusJoinsNow(m, [tab('t1', []), later, made], new Set(['t1', 't2', 't3']), IDS),
    ).toEqual(new Map([['bug', ['y']]]));
  });

  it('starts a type first seen from what it can use, without joining it', () => {
    const m = newJoinMemory();
    const t1 = tab('t1', [board('b', ['todo'])]);
    statusJoinsNow(m, [t1], new Set(['t1']), ['bug']);
    // The same tab, read again for the new set of types: the new type is seeded.
    expect(statusJoinsNow(m, [t1], new Set(['t1']), ['bug', 'story'])).toEqual(new Map());
    const t1b = tab('t1', [board('b', ['todo', 'qa'])]);
    expect(statusJoinsNow(m, [t1b], new Set(['t1']), ['bug', 'story'])).toEqual(
      new Map([
        ['bug', ['qa']],
        ['story', ['qa']],
      ]),
    );
  });

  it('gives nothing from a board naming only types not yet in the catalogue', () => {
    const m = newJoinMemory();
    statusJoinsNow(m, [tab('t1', [])], new Set(['t1']), IDS);
    const triage = tab('t1', [board('b', ['new'], ['request'])]);
    expect(statusJoinsNow(m, [triage], new Set(['t1']), IDS)).toEqual(new Map());
  });

  it('skips a tab whose elements have not changed, and one not read', () => {
    const m = newJoinMemory();
    const t1 = tab('t1', [board('b', ['todo'])]);
    statusJoinsNow(m, [t1], new Set(), IDS);
    expect(m.readTabs.size).toBe(0);
    statusJoinsNow(m, [t1], new Set(['t1']), IDS);
    expect(statusJoinsNow(m, [t1], new Set(['t1']), IDS)).toEqual(new Map());
  });
});

describe('useTypeStatusJoins', () => {
  const def = (id: string, more: Partial<ItemTypeDef> = {}): ItemTypeDef => ({
    ...ITEM_TYPES[1],
    id,
    label: id,
    ...more,
  });
  const cat = (...types: ItemTypeDef[]): ItemTypeCatalogue => ({ version: 1, types });
  const run = (
    catalogue: ItemTypeCatalogue | null,
    tabs: Tab[],
    loaded: string[],
    enabled = true,
  ) => {
    const quietChange =
      vi.fn<(remake: (c: ItemTypeCatalogue | null) => ItemTypeCatalogue | null) => void>();
    const hook = renderHook(
      (p: { tabs: Tab[]; loaded: Set<string> }) =>
        useTypeStatusJoins({
          tabs: p.tabs,
          loadedTabIds: p.loaded,
          enabled,
          catalogue,
          quietChange,
        }),
      { initialProps: { tabs, loaded: new Set(loaded) } },
    );
    return { hook, quietChange };
  };

  it('writes each legacy type in the new shape once every tab is read, once a session', () => {
    const catalogue = cat(
      def('bug', { excludedStatuses: ['doing'] }),
      def('story', { statuses: ['todo'] }),
    );
    const t1 = tab('t1', [board('b', ['todo', 'doing'])]);
    const t2 = tab('t2', [board('c', ['done'])]);
    const { hook, quietChange } = run(catalogue, [t1, t2], ['t1']);
    expect(quietChange).not.toHaveBeenCalled();
    hook.rerender({ tabs: [t1, t2], loaded: new Set(['t1', 't2']) });
    expect(quietChange).toHaveBeenCalledTimes(1);
    const next = quietChange.mock.calls[0]![0](catalogue) as ItemTypeCatalogue;
    expect(next.types.map((t) => t.statuses)).toEqual([['todo', 'done'], ['todo']]);
    // A later edit tries no legacy type again.
    hook.rerender({ tabs: [t1, tab('t2', [board('c', ['done'])])], loaded: new Set(['t1', 't2']) });
    expect(quietChange).toHaveBeenCalledTimes(1);
  });

  it('joins a new board’s statuses to the types it takes', () => {
    const catalogue = cat(def('bug', { statuses: ['new'] }), def('story', { statuses: ['todo'] }));
    const t1 = tab('t1', [board('b', ['new'], ['bug'])]);
    const { hook, quietChange } = run(catalogue, [t1], ['t1']);
    expect(quietChange).not.toHaveBeenCalled();
    const t1b = tab('t1', [...t1.elements, board('s', ['backlog'], ['story'])]);
    hook.rerender({ tabs: [t1b], loaded: new Set(['t1']) });
    const next = quietChange.mock.lastCall![0](catalogue) as ItemTypeCatalogue;
    expect(next.types.map((t) => t.statuses)).toEqual([['new'], ['todo', 'backlog']]);
  });

  it('does nothing for someone who may not change card types, or before the types are read', () => {
    const t1 = tab('t1', [board('b', ['todo'])]);
    expect(run(cat(def('bug')), [t1], ['t1'], false).quietChange).not.toHaveBeenCalled();
    expect(run(null, [t1], ['t1']).quietChange).not.toHaveBeenCalled();
  });
});
