import { describe, expect, it } from 'vitest';
import { MAX_SELECTION_IDS } from '@livediagram/api-schema';
import { RoomSelectionStore, selectionFromOp, type LiveSession } from './room-selections';

// The room's record of who holds what (docs/specs/024-agents/agent-changesets.md "What the room
// does", CS38): each session's whole selection in DO storage, answered to the api's held check.

function memoryStorage() {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async <T>(key: string) => map.get(key) as T | undefined,
    put: async (key: string, value: unknown) => void map.set(key, value),
    delete: async (key: string) => map.delete(key),
    list: async ({ prefix }: { prefix: string }) =>
      new Map([...map].filter(([k]) => k.startsWith(prefix))),
  };
}

const live = (entries: [string, LiveSession][]) => new Map(entries);
const bea: LiveSession = { name: 'Bea', color: '#f00', personTag: 'tag-bea' };
const webber: LiveSession = { name: 'Webber', color: '#0ea5e9', personTag: 'tag-webber' };

describe('selectionFromOp', () => {
  it('reads the whole selection, defaulting to the single element', () => {
    expect(
      selectionFromOp({ kind: 'select', elementId: 'a', tabId: 't1', elementIds: ['a', 'b'] }),
    ).toEqual({
      tabId: 't1',
      elementIds: ['a', 'b'],
    });
    expect(selectionFromOp({ kind: 'select', elementId: 'a', tabId: 't1' })).toEqual({
      tabId: 't1',
      elementIds: ['a'],
    });
  });

  it('reads a cleared selection as null and drops what is not a string', () => {
    expect(selectionFromOp({ kind: 'select', elementId: null, tabId: 't1' })).toBeNull();
    expect(
      selectionFromOp({ kind: 'select', elementId: null, tabId: 't1', elementIds: [] }),
    ).toBeNull();
    expect(
      selectionFromOp({ kind: 'select', elementId: null, tabId: 't1', elementIds: ['a', 'b'] }),
    ).toEqual({ tabId: 't1', elementIds: ['a', 'b'] });
    expect(
      selectionFromOp({ kind: 'select', elementId: 'a', tabId: 't1', elementIds: ['a', 4, null] }),
    ).toEqual({ tabId: 't1', elementIds: ['a'] });
  });

  it(`clamps a hostile selection to ${MAX_SELECTION_IDS} ids`, () => {
    const ids = Array.from({ length: MAX_SELECTION_IDS + 50 }, (_, i) => `e${i}`);
    expect(
      selectionFromOp({ kind: 'select', elementId: 'e0', tabId: 't1', elementIds: ids })
        ?.elementIds,
    ).toHaveLength(MAX_SELECTION_IDS);
  });
});

describe('RoomSelectionStore', () => {
  it("answers each live session's selection on the tab, marking the agent owner's own", async () => {
    const storage = memoryStorage();
    const store = new RoomSelectionStore(storage);
    await store.note('p-bea', { tabId: 't1', elementIds: ['a', 'b'] });
    await store.note('p-webber', { tabId: 't1', elementIds: ['c'] });
    await store.note('p-other-tab', { tabId: 't2', elementIds: ['a'] });
    const answer = await store.read(
      't1',
      live([
        ['p-bea', bea],
        ['p-webber', webber],
        ['p-other-tab', bea],
      ]),
      'tag-webber',
    );
    expect(answer).toEqual([
      { elementIds: ['a', 'b'], name: 'Bea', color: '#f00', mine: false },
      { elementIds: ['c'], name: 'Webber', color: '#0ea5e9', mine: true },
    ]);
  });

  it('never marks a session mine without both tags', async () => {
    const store = new RoomSelectionStore(memoryStorage());
    await store.note('p', { tabId: 't1', elementIds: ['a'] });
    const untagged = live([['p', { ...bea, personTag: null }]]);
    expect((await store.read('t1', untagged, ''))[0]!.mine).toBe(false);
    expect((await store.read('t1', live([['p', bea]]), ''))[0]!.mine).toBe(false);
  });

  it('forgets a cleared selection and a dropped session, and prunes entries with no socket', async () => {
    const storage = memoryStorage();
    const store = new RoomSelectionStore(storage);
    await store.note('p-bea', { tabId: 't1', elementIds: ['a'] });
    await store.note('p-gone', { tabId: 't1', elementIds: ['b'] });
    await store.note('p-left', { tabId: 't1', elementIds: ['c'] });
    await store.note('p-bea', null);
    await store.drop('p-left');
    expect(await store.read('t1', live([]), 'x')).toEqual([]);
    expect(storage.map.size).toBe(0);
  });
});
