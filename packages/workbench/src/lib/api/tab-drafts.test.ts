import { describe, expect, it, vi } from 'vitest';
import {
  TAB_DRAFT_MAX_CHARS,
  createTabDrafts,
  judgeTabDraft,
  type TabDraftEvent,
  type TabDraftRecord,
  type TabDraftStore,
} from './tab-drafts';

// Drafts of unsaved changes (livediagram's docs/specs/006-document/delta-saves.md "Drafts of unsaved changes"): what is
// kept, when it goes, and the next load's verdict, over an in-memory store.

type T = { id: string; name?: string; elements: { id: string; label?: string }[] };

function memoryStore() {
  const map = new Map<string, unknown>();
  const store: TabDraftStore = {
    read: vi.fn(async (key: string) => map.get(key)),
    write: vi.fn((key: string, record: TabDraftRecord) => void map.set(key, record)),
    remove: vi.fn((key: string) => void map.delete(key)),
  };
  return { map, store };
}

const KEY = 'me␟d1␟t1';
const el = (id: string, label = id) => ({ id, label });
const tabJson = (elements: T['elements'], extra: Partial<T> = {}) =>
  JSON.stringify({ id: 't1', name: 'Board', elements, ...extra });

function setup() {
  const { map, store } = memoryStore();
  const drafts = createTabDrafts<T>(store);
  const events: TabDraftEvent[] = [];
  drafts.subscribe((e) => events.push(e));
  // A draft made over revision 4: `b` changed, `c` removed.
  const keep = (over: Partial<Omit<TabDraftRecord, 'v'>> = {}) =>
    drafts.write('me', 'd1', 't1', {
      baseRev: 4,
      tab: tabJson([el('a'), el('b', 'mine')]),
      changed: ['b'],
      removed: ['c'],
      ...over,
    });
  const load = async (rev: number, elements: T['elements']) =>
    drafts.settle('me', 'd1', 't1', await drafts.read('me', 'd1', 't1'), { rev, elements });
  return { map, store, drafts, events, keep, load };
}

describe('keeping a draft', () => {
  it('stores it under the person, item and tab, stamped with its version', () => {
    const { map, keep } = setup();
    keep();
    expect(map.get(KEY)).toEqual({
      v: 1,
      baseRev: 4,
      tab: tabJson([el('a'), el('b', 'mine')]),
      changed: ['b'],
      removed: ['c'],
    });
  });

  it('keeps none past the size bound, and removes an older one', () => {
    const { map, store, keep } = setup();
    keep();
    keep({ tab: 'x'.repeat(TAB_DRAFT_MAX_CHARS + 1) });
    expect(map.has(KEY)).toBe(false);
    expect(store.remove).toHaveBeenCalledWith(KEY);
  });

  it('works on without storage: a throwing store keeps nothing and throws nothing', async () => {
    const boom = () => {
      throw new Error('no storage');
    };
    const drafts = createTabDrafts<T>({
      read: () => Promise.reject(new Error('no storage')),
      write: boom,
      remove: boom,
    });
    expect(() =>
      drafts.write('me', 'd1', 't1', { baseRev: 1, tab: '{}', changed: null, removed: null }),
    ).not.toThrow();
    expect(() => drafts.saveLanded('me', 'd1', 't1', drafts.saveStarted())).not.toThrow();
    expect(await drafts.read('me', 'd1', 't1')).toBeUndefined();
  });
});

describe('a landed save clears it', () => {
  it('clears a draft kept before the save started', () => {
    const { map, drafts, keep } = setup();
    keep();
    const started = drafts.saveStarted();
    drafts.saveLanded('me', 'd1', 't1', started);
    expect(map.has(KEY)).toBe(false);
  });

  it('keeps a draft kept after the save started: the save does not carry it', () => {
    const { map, drafts, keep } = setup();
    const started = drafts.saveStarted();
    keep();
    drafts.saveLanded('me', 'd1', 't1', started);
    expect(map.has(KEY)).toBe(true);
  });

  it('touches nothing for a tab with no draft known', () => {
    const { store, drafts } = setup();
    drafts.saveLanded('me', 'd1', 't1', drafts.saveStarted());
    expect(store.remove).not.toHaveBeenCalled();
  });
});

describe('the next load', () => {
  it('finds nothing when there is no draft', async () => {
    const { load, events } = setup();
    expect(await load(4, [el('a')])).toEqual({ kind: 'none' });
    expect(events).toEqual([]);
  });

  it('puts the draft back while the api still holds its revision, until a later save lands', async () => {
    const { map, keep } = setup();
    keep();
    // A new page: what this one wrote is not known to it.
    const fresh = createTabDrafts<T>({
      read: async (key) => map.get(key),
      write: () => {},
      remove: (key) => void map.delete(key),
    });
    const seen: TabDraftEvent[] = [];
    fresh.subscribe((e) => seen.push(e));
    const verdict = fresh.settle(
      'me',
      'd1',
      't1',
      await fresh.read('me', 'd1', 't1'),
      { rev: 4, elements: [el('a'), el('b'), el('c')] },
      (tab) => ({ ...tab, name: 'normalized' }),
    );
    expect(verdict).toEqual({
      kind: 'replay',
      tab: { id: 't1', name: 'normalized', elements: [el('a'), el('b', 'mine')] },
    });
    expect(seen).toEqual([
      { kind: 'replay', ownerId: 'me', itemId: 'd1', tabId: 't1', name: null },
    ]);
    // Waiting for the editor, once.
    expect(fresh.takeReplay('me', 'd1', 't1')?.name).toBe('normalized');
    expect(fresh.takeReplay('me', 'd1', 't1')).toBeNull();
    // Still stored until a save that started after it lands.
    expect(map.has(KEY)).toBe(true);
    fresh.saveLanded('me', 'd1', 't1', fresh.saveStarted());
    expect(map.has(KEY)).toBe(false);
  });

  it('discards a draft the editor could not put on screen: stored and waiting, both gone', async () => {
    const { map, drafts, keep, load } = setup();
    keep();
    expect((await load(4, [])).kind).toBe('replay');
    drafts.discard('me', 'd1', 't1');
    expect(map.has(KEY)).toBe(false);
    expect(drafts.takeReplay('me', 'd1', 't1')).toBeNull();
  });

  it('puts the draft back as kept when the product normalises nothing', async () => {
    const { keep, load } = setup();
    keep();
    expect(await load(4, [])).toEqual({
      kind: 'replay',
      tab: { id: 't1', name: 'Board', elements: [el('a'), el('b', 'mine')] },
    });
  });

  it('removes a draft whose flush landed after all: the stored elements are the draft’s', async () => {
    const { map, events, keep, load } = setup();
    keep();
    expect(await load(5, [el('a'), el('b', 'mine')])).toEqual({ kind: 'saved' });
    expect(map.has(KEY)).toBe(false);
    expect(events).toEqual([]);
  });

  it('removes a draft whose changes are all stored though somebody saved other elements since', async () => {
    const { map, events, keep, load } = setup();
    keep();
    expect(await load(6, [el('a', 'theirs'), el('b', 'mine')])).toEqual({ kind: 'saved' });
    expect(map.has(KEY)).toBe(false);
    expect(events).toEqual([]);
  });

  it('drops a draft somebody overtook, never putting it back, and says so', async () => {
    const { map, events, keep, load } = setup();
    keep();
    expect(await load(5, [el('a'), el('b', 'theirs')])).toEqual({ kind: 'stale', name: 'Board' });
    expect(map.has(KEY)).toBe(false);
    expect(events).toEqual([
      { kind: 'stale', ownerId: 'me', itemId: 'd1', tabId: 't1', name: 'Board' },
    ]);
  });

  it('a removed element still stored, or a changed one gone, is overtaken', async () => {
    const { keep, load } = setup();
    keep();
    expect((await load(5, [el('a'), el('b', 'mine'), el('c')])).kind).toBe('stale');
    keep();
    expect((await load(5, [el('a')])).kind).toBe('stale');
  });

  it('with no delta planned, only the whole elements tell a landed flush', async () => {
    const { keep, load } = setup();
    keep({ changed: null, removed: null });
    expect((await load(5, [el('a', 'theirs'), el('b', 'mine')])).kind).toBe('stale');
  });

  it('removes a draft this build cannot read, silently', async () => {
    const { map, events, load } = setup();
    const bad: unknown[] = [
      'text',
      { v: 2, baseRev: 1, tab: tabJson([]), changed: null, removed: null },
      { v: 1, baseRev: -1, tab: tabJson([]), changed: null, removed: null },
      { v: 1, baseRev: 1.5, tab: tabJson([]), changed: null, removed: null },
      { v: 1, baseRev: 1, tab: 7, changed: null, removed: null },
      { v: 1, baseRev: 1, tab: '{not json', changed: null, removed: null },
      { v: 1, baseRev: 1, tab: 'null', changed: null, removed: null },
      {
        v: 1,
        baseRev: 1,
        tab: JSON.stringify({ id: 'other', elements: [] }),
        changed: null,
        removed: null,
      },
      { v: 1, baseRev: 1, tab: JSON.stringify({ id: 't1' }), changed: null, removed: null },
      { v: 1, baseRev: 1, tab: tabJson([]), changed: [1], removed: null },
      { v: 1, baseRev: 1, tab: tabJson([]), changed: null, removed: 'c' },
      null,
    ];
    for (const raw of bad) {
      map.set(KEY, raw);
      expect(await load(1, [])).toEqual({ kind: 'none' });
      expect(map.has(KEY)).toBe(raw === null);
    }
    expect(events).toEqual([]);
  });

  it('names no tab when the draft has no name', () => {
    const verdict = judgeTabDraft(
      { v: 1, baseRev: 1, tab: { id: 't1', elements: [el('a')] }, changed: null, removed: null },
      { rev: 2, elements: [] },
    );
    expect(verdict).toEqual({ kind: 'stale', name: null });
  });

  it('a listener that throws does not stop the others, and one can stop listening', async () => {
    const { drafts, events, keep, load } = setup();
    drafts.subscribe(() => {
      throw new Error('listener');
    });
    const later: TabDraftEvent[] = [];
    const stop = drafts.subscribe((e) => later.push(e));
    stop();
    keep();
    await load(5, []);
    expect(events).toHaveLength(1);
    expect(later).toEqual([]);
  });
});
