import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planTabDelta } from '@liveworkspace/api-schema/tab-delta';
import { diffToElementOps, type Element, type Tab } from '@livediagram/document';
import { apiLoadTabRevisioned, apiSaveTab, flushDocumentSavesBeacon } from './tabs';
import { offlineSaveTab } from '../offline/offline-store';
import { box, bytes, fakeApi, kinds, tabOf, withLabel } from './tab-api-test-kit';

// The autosave's delta saves (docs/specs/006-document/delta-saves.md "How the editor uses it"), through the editor's
// own binding and the real element diff, against a small stand-in for the api's tab doors: the GET, the whole PUT
// (stores and echoes) and the delta door (rebuilds over the stored copy, proves the digest, or refuses).

vi.mock('../guest-token', () => ({
  readGuestToken: () => ({ token: 'guest-jwt', id: 'guest_1', expiresAt: 1 }),
}));

vi.mock('../offline/offline-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offline/offline-store')>()),
  isOfflineId: vi.fn(async (id: string) => id.startsWith('local-')),
  isOfflineIdSync: vi.fn((id: string) => id.startsWith('local-')),
  offlineSaveTab: vi.fn(async () => {}),
}));

let api: ReturnType<typeof fakeApi>;
beforeEach(() => {
  api = fakeApi();
  vi.stubGlobal('fetch', api.fetch);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Each test its own document, so the base copies one test holds never reach another.
let n = 0;
const docId = () => `d${++n}`;

describe('a small edit on a 2,000-element tab', () => {
  it('sends a small delta instead of the whole tab', async () => {
    const doc = docId();
    const tab = tabOf(Array.from({ length: 2000 }, (_, i) => box(i)));
    // The first save of a new tab is whole: no base copy.
    await apiSaveTab('owner', doc, tab);
    const edited = withLabel(tab, 1234, 'Step 1234, renamed');
    expect(await apiSaveTab('owner', doc, edited)).toBe(2);
    expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta']);
    const [whole, delta] = api.sent;
    expect(bytes(whole!)).toBeGreaterThan(250_000);
    expect(bytes(delta!)).toBeLessThan(600);
    expect(api.store.get('t1')!.tab.elements).toEqual(edited.elements);
  });
});

describe('base copy sources', () => {
  it("the tab's load: the first save after opening is a delta", async () => {
    const doc = docId();
    const elements = Array.from({ length: 40 }, (_, i) => box(i));
    api.store.set('t1', { tab: { id: 't1', name: 'Board', elements }, rev: 5 });
    const loaded = (await apiLoadTabRevisioned('owner', doc, 't1', null))!;
    expect(await apiSaveTab('owner', doc, withLabel(loaded.tab, 3, 'moved'))).toBe(6);
    expect(kinds(api.sent)).toEqual(['GET tab', 'POST delta']);
  });

  it('the load holds the elements as stored, before a ragged table is made rectangular', async () => {
    const doc = docId();
    const table = { id: 'tbl', type: 'table', x: 0, y: 0, cells: [['a', 'b'], ['c']] };
    const elements = [...Array.from({ length: 40 }, (_, i) => box(i)), table as unknown as Element];
    api.store.set('t1', { tab: { id: 't1', name: 'Board', elements }, rev: 2 });
    const loaded = (await apiLoadTabRevisioned('owner', doc, 't1', null))!;
    expect((loaded.tab.elements[40] as unknown as { cells: string[][] }).cells[1]).toEqual([
      'c',
      '',
    ]);
    // The rectangular table is an update over the stored ragged one, and the rebuild proves.
    expect(await apiSaveTab('owner', doc, withLabel(loaded.tab, 0, 'x'))).toBe(3);
    expect(kinds(api.sent)).toEqual(['GET tab', 'POST delta']);
    expect(api.store.get('t1')!.tab.elements[40]).toEqual(loaded.tab.elements[40]);
  });

  it("a whole save's echo, and then each delta the api confirms", async () => {
    const doc = docId();
    let tab = tabOf(Array.from({ length: 40 }, (_, i) => box(i)));
    await apiSaveTab('owner', doc, tab);
    tab = withLabel(tab, 1, 'one');
    await apiSaveTab('owner', doc, tab);
    tab = withLabel(tab, 2, 'two');
    expect(await apiSaveTab('owner', doc, tab)).toBe(3);
    expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta', 'POST delta']);
    expect(JSON.parse(api.sent[2]!.body)).toMatchObject({ baseRev: 2 });
  });

  it('a delta whose stored digest differs (the save merged something in) leaves the next save whole', async () => {
    const doc = docId();
    let tab = tabOf(Array.from({ length: 40 }, (_, i) => box(i)));
    await apiSaveTab('owner', doc, tab);
    api.next.merge = (els) => els.map((el, i) => (i === 9 ? { ...el, label: 'theirs' } : el));
    tab = withLabel(tab, 1, 'one');
    await apiSaveTab('owner', doc, tab);
    tab = withLabel(tab, 2, 'two');
    await apiSaveTab('owner', doc, tab);
    tab = withLabel(tab, 3, 'three');
    await apiSaveTab('owner', doc, tab);
    expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta', 'PUT tab', 'POST delta']);
  });
});

describe('a refused delta saves whole', () => {
  it("in the same save, answering the whole save's revision", async () => {
    const doc = docId();
    let tab = tabOf(Array.from({ length: 40 }, (_, i) => box(i)));
    await apiSaveTab('owner', doc, tab);
    // Another writer saved since this editor's base copy.
    const theirs = api.store.get('t1')!;
    api.store.set('t1', { ...theirs, rev: theirs.rev + 1 });
    tab = withLabel(tab, 1, 'one');
    expect(await apiSaveTab('owner', doc, tab)).toBe(3);
    expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta', 'PUT tab']);
    expect(console.info).toHaveBeenCalledWith('[tab-delta] refused', {
      tabId: 't1',
      reason: 'stale_base',
    });
    expect(api.store.get('t1')!.tab.elements).toEqual(tab.elements);
    // The whole save's echo is the next base copy.
    tab = withLabel(tab, 2, 'two');
    await apiSaveTab('owner', doc, tab);
    expect(kinds(api.sent).at(-1)).toBe('POST delta');
  });

  it('for every refusal reason', async () => {
    for (const reason of ['too_many_ops', 'no_base', 'digest_mismatch']) {
      const doc = docId();
      api.sent.length = 0;
      let tab = tabOf(Array.from({ length: 40 }, (_, i) => box(i)));
      await apiSaveTab('owner', doc, tab);
      api.next.refuse = reason;
      tab = withLabel(tab, 1, reason);
      await apiSaveTab('owner', doc, tab);
      expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta', 'PUT tab']);
      expect(api.store.get('t1')!.tab.elements).toEqual(tab.elements);
    }
  });

  it("the whole save's own refusals surface from a delta as from the whole save", async () => {
    const doc = docId();
    let tab = tabOf(Array.from({ length: 40 }, (_, i) => box(i)));
    await apiSaveTab('owner', doc, tab);
    api.next.status = 409;
    tab = withLabel(tab, 1, 'one');
    await expect(apiSaveTab('owner', doc, tab)).rejects.toThrow();
    expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta']);
  });
});

describe('the delta carries what the whole save carries', () => {
  it('the headers, and the tab fields beside the elements', async () => {
    const doc = docId();
    let tab: Tab = { ...tabOf(Array.from({ length: 40 }, (_, i) => box(i))), folder: 'f1' };
    await apiSaveTab('owner', doc, tab);
    tab = { ...withLabel(tab, 1, 'one'), name: 'Renamed' };
    await apiSaveTab('owner', doc, tab, null, {
      allowEmpty: true,
      changesetSeen: 4,
      roomCursor: { epoch: 'e', seq: 9 },
    });
    const delta = api.sent[1]!;
    expect(delta.headers.get('X-Allow-Empty')).toBe('1');
    expect(delta.headers.get('X-Changeset-Seen')).toBe('4');
    expect(delta.headers.get('X-Room-Cursor')).toBe('e:9');
    const body = JSON.parse(delta.body) as { tab: Record<string, unknown> };
    // The wire tab: UI-only fields stripped and the kind stamped, as the whole save sends it.
    expect(body.tab).toMatchObject({ id: 't1', name: 'Renamed' });
    expect(body.tab).not.toHaveProperty('folder');
    expect(body.tab).not.toHaveProperty('elements');
    expect(api.store.get('t1')!.tab.name).toBe('Renamed');
  });
});

describe('a document in This Browser', () => {
  it('never sends a delta: it has no api', async () => {
    const tab = tabOf(Array.from({ length: 40 }, (_, i) => box(i)));
    await apiSaveTab('owner', 'local-1', tab);
    await apiSaveTab('owner', 'local-1', withLabel(tab, 1, 'one'));
    expect(api.sent).toEqual([]);
    expect(offlineSaveTab).toHaveBeenCalledTimes(2);
  });
});

// The unload flush (docs/specs/006-document/delta-saves.md "Unload"): a delta within the keepalive budget, or as before.
describe('the unload flush', () => {
  const flush = (doc: string, tab: Tab) =>
    flushDocumentSavesBeacon({
      ownerId: 'owner',
      documentId: doc,
      shareCode: null,
      changedTabs: [tab],
      deletedIds: [],
      loadedTabIds: new Set([tab.id]),
      orderChanged: false,
      nameChanged: false,
      name: 'Doc',
      tabs: [tab],
      changesetSeen: new Map([[tab.id, 7]]),
    });
  const settled = () => api.settled();
  const big = () => tabOf(Array.from({ length: 2000 }, (_, i) => box(i)));
  const editedWhere = (tab: Tab, n: number, change: (el: Element) => Element): Tab => ({
    ...tab,
    elements: tab.elements.map((el, i) => (i < n ? change(el) : el)),
  });

  it('sends a one-shape edit on a 2,000-element tab as a keepalive delta, under 1 KB', async () => {
    const doc = docId();
    const tab = big();
    await apiSaveTab('owner', doc, tab);
    const edited = withLabel(tab, 1234, 'Step 1234, renamed');
    flush(doc, edited);
    await settled();
    expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta']);
    const [whole, delta] = api.sent;
    // Before: the whole tab, far past the browser's 64 KB keepalive cap.
    expect(bytes(whole!)).toBeGreaterThan(250_000);
    expect(bytes(delta!)).toBeLessThan(1024);
    expect(delta!.keepalive).toBe(true);
    // The flush's own headers ride with it.
    expect(delta!.headers.get('X-Allow-Empty')).toBe('1');
    expect(delta!.headers.get('X-Changeset-Seen')).toBe('7');
    expect(api.store.get('t1')!.tab.elements).toEqual(edited.elements);
    // Landed with a matching digest: the next save is a delta over it.
    await apiSaveTab('owner', doc, withLabel(edited, 3, 'after'));
    expect(kinds(api.sent).at(-1)).toBe('POST delta');
    expect(JSON.parse(api.sent.at(-1)!.body)).toMatchObject({ baseRev: 2 });
  });

  it('sends the tab whole, as before, with no base copy', async () => {
    const doc = docId();
    flush(doc, tabOf(Array.from({ length: 40 }, (_, i) => box(i))));
    await settled();
    expect(kinds(api.sent)).toEqual(['PUT tab']);
    expect(api.sent[0]!.keepalive).toBe(true);
  });

  it('sends the tab whole when the diff is too large for a delta', async () => {
    const doc = docId();
    const tab = big();
    await apiSaveTab('owner', doc, tab);
    // 600 shapes renamed: past the 500-op cap.
    flush(
      doc,
      editedWhere(tab, 600, (el) => ({ ...el, label: 'renamed' })),
    );
    await settled();
    expect(kinds(api.sent)).toEqual(['PUT tab', 'PUT tab']);
    // Past the keepalive budget, as before: a plain request.
    expect(api.sent[1]!.keepalive).toBe(false);
  });

  it('sends the tab whole when the delta would not fit the keepalive budget', async () => {
    const doc = docId();
    const tab = big();
    await apiSaveTab('owner', doc, tab);
    // 400 labels rewritten long: a delta of about 130 KB, within the share cap but past the 60 KB budget.
    const long = 'x'.repeat(200);
    const edited = editedWhere(tab, 400, (el) => ({ ...el, label: long }));
    const plan = await planTabDelta({
      base: { rev: 1, elements: tab.elements },
      tab: edited,
      diff: diffToElementOps,
    });
    expect(plan!.body.length).toBeGreaterThan(60 * 1024);
    flush(doc, edited);
    await settled();
    expect(kinds(api.sent)).toEqual(['PUT tab', 'PUT tab']);
    expect(api.store.get('t1')!.tab.elements).toEqual(edited.elements);
  });

  it('a refused delta stores nothing, and the whole tab follows while the page lives on', async () => {
    const doc = docId();
    const tab = big();
    await apiSaveTab('owner', doc, tab);
    api.next.refuse = 'stale_base';
    const edited = withLabel(tab, 5, 'last edit');
    flush(doc, edited);
    await settled();
    expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta', 'PUT tab']);
    expect(api.store.get('t1')!.tab.elements).toEqual(edited.elements);
  });

  it("another failure sends nothing more: the whole save's own refusals stand", async () => {
    const doc = docId();
    const tab = big();
    await apiSaveTab('owner', doc, tab);
    api.next.status = 409;
    flush(doc, withLabel(tab, 5, 'last edit'));
    await settled();
    expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta']);
  });
});
