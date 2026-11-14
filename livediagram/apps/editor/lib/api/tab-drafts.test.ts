import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { TabDraftEvent } from '@liveworkspace/workbench/lib/api/tab-drafts';
import { box, fakeApi, kinds, tabOf, withLabel } from './tab-api-test-kit';
import { TAB_DRAFTS_DB } from './tab-draft-store';

// Drafts of unsaved changes (docs/specs/006-document/delta-saves.md "Drafts of unsaved changes"), through the
// editor's own binding and a real (fake-indexeddb) IndexedDB: the unload flush keeps a draft of a 2,000-element tab,
// the page goes, and the next page's load decides on it. Each page is a fresh copy of the binding, as a reload is.

vi.mock('../guest-token', () => ({
  readGuestToken: () => ({ token: 'guest-jwt', id: 'guest_1', expiresAt: 1 }),
}));

vi.mock('../offline/offline-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offline/offline-store')>()),
  isOfflineId: vi.fn(async (id: string) => id.startsWith('local-')),
  isOfflineIdSync: vi.fn((id: string) => id.startsWith('local-')),
}));

type Page = typeof import('./tabs') & { events: TabDraftEvent[] };

async function newPage(): Promise<Page> {
  vi.resetModules();
  const calls = await import('./tabs');
  const events: TabDraftEvent[] = [];
  calls.onTabDraft((e) => events.push(e));
  return Object.assign(calls, { events });
}

// The drafts stored, read round the editor's own connection.
function storedDrafts(): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TAB_DRAFTS_DB);
    req.onupgradeneeded = () => req.result.createObjectStore('drafts');
    req.onsuccess = () => {
      const db = req.result;
      const all = db.transaction('drafts', 'readonly').objectStore('drafts').getAll();
      all.onsuccess = () => {
        db.close();
        resolve(all.result);
      };
      all.onerror = () => reject(new Error(String(all.error)));
    };
    req.onerror = () => reject(new Error(String(req.error)));
  });
}

let api: ReturnType<typeof fakeApi>;
// What the page cannot hear once it has gone: `gone` refuses every later request, `deaf` lets one through to the
// api and loses its answer.
const page = { gone: false, deaf: false };
beforeEach(() => {
  api = fakeApi();
  page.gone = false;
  page.deaf = false;
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    if (page.gone) return Promise.reject(new TypeError('the page has gone'));
    const answer = api.fetch(input, init);
    if (!page.deaf) return answer;
    page.gone = true;
    return answer.then(() => Promise.reject(new TypeError('the page has gone')));
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await api.settled();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(TAB_DRAFTS_DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

let n = 0;
const docId = () => `drafts${++n}`;
const big = () => tabOf(Array.from({ length: 2000 }, (_, i) => box(i)));
// A short wait for IndexedDB's own callbacks, which no request awaits.
const idle = () => new Promise((resolve) => setTimeout(resolve, 20));

// The first page: the stored tab, loaded, one label edited, then closed with the edit still in the debounce;
// `closing` runs as the page goes, just before the flush.
async function closeWithAnEdit(closing = () => {}): Promise<{ documentId: string; edited: Tab }> {
  const documentId = docId();
  const first = await newPage();
  await first.apiSaveTab('guest_1', documentId, big(), null, { allowEmpty: true });
  const loaded = (await first.apiLoadTabRevisioned('guest_1', documentId, 't1', null))!;
  const edited = withLabel(loaded.tab, 5, 'The last edit');
  closing();
  first.flushDocumentSavesBeacon({
    ownerId: 'guest_1',
    documentId,
    shareCode: null,
    changedTabs: [edited],
    deletedIds: [],
    loadedTabIds: new Set(['t1']),
    orderChanged: false,
    nameChanged: false,
    name: 'Doc',
    tabs: [edited],
  });
  await api.settled();
  await idle();
  return { documentId, edited };
}

describe('a draft of the unload flush', () => {
  it('a refused close-time flush reappears on the next load and saves', async () => {
    // The api refuses the delta as the page goes: the whole tab that would follow is never sent.
    const { documentId, edited } = await closeWithAnEdit(() => {
      api.next.refuse = 'digest_mismatch';
      page.deaf = true;
    });
    expect(api.store.get('t1')!.rev).toBe(1);
    expect(await storedDrafts()).toHaveLength(1);

    page.gone = false;
    page.deaf = false;
    const next = await newPage();
    const loaded = (await next.apiLoadTabRevisioned('guest_1', documentId, 't1', null))!;
    // The tab as stored, and the draft waiting for the editor to put on screen.
    expect(loaded.tab.elements[5]).toMatchObject({ label: 'Step 5' });
    expect(next.events.map((e) => e.kind)).toEqual(['replay']);
    const draft = next.apiTakeDraftReplay('guest_1', documentId, 't1')!;
    expect(draft.elements[5]).toMatchObject({ label: 'The last edit' });
    expect(JSON.stringify(draft.elements)).toBe(JSON.stringify(edited.elements));

    // The autosave saves it, as a delta over the copy just loaded, and the draft goes once that lands.
    const firstSave = api.sent.length;
    await next.apiSaveTab('guest_1', documentId, draft, null, { allowEmpty: true });
    expect(kinds(api.sent.slice(firstSave))).toEqual(['POST delta']);
    expect(api.store.get('t1')!.tab.elements[5]).toMatchObject({ label: 'The last edit' });
    await idle();
    expect(await storedDrafts()).toHaveLength(0);
  });

  it('a draft older than what the api holds never overwrites the newer work, and says so', async () => {
    const { documentId } = await (async () => {
      // Somebody else saves the tab first: the flush's delta is stale, and its whole tab dies with the page.
      const documentId = docId();
      const first = await newPage();
      await first.apiSaveTab('guest_1', documentId, big(), null, { allowEmpty: true });
      const loaded = (await first.apiLoadTabRevisioned('guest_1', documentId, 't1', null))!;
      const other = await newPage();
      await other.apiSaveTab('guest_2', documentId, withLabel(big(), 5, 'Their edit'), null, {
        allowEmpty: true,
      });
      const edited = withLabel(loaded.tab, 5, 'My last edit');
      page.deaf = true;
      first.flushDocumentSavesBeacon({
        ownerId: 'guest_1',
        documentId,
        shareCode: null,
        changedTabs: [edited],
        deletedIds: [],
        loadedTabIds: new Set(['t1']),
        orderChanged: false,
        nameChanged: false,
        name: 'Doc',
        tabs: [edited],
      });
      await api.settled();
      await idle();
      return { documentId };
    })();
    expect(api.sent.at(-1)).toMatchObject({ method: 'POST' });
    expect(await storedDrafts()).toHaveLength(1);

    page.gone = false;
    page.deaf = false;
    const next = await newPage();
    const firstSent = api.sent.length;
    const loaded = (await next.apiLoadTabRevisioned('guest_1', documentId, 't1', null))!;
    expect(loaded.tab.elements[5]).toMatchObject({ label: 'Their edit' });
    expect(next.events).toEqual([
      { kind: 'stale', ownerId: 'guest_1', itemId: documentId, tabId: 't1', name: 'Board' },
    ]);
    expect(next.apiTakeDraftReplay('guest_1', documentId, 't1')).toBeNull();
    // Only the load went: nothing was saved over their work.
    expect(kinds(api.sent.slice(firstSent))).toEqual(['GET tab']);
    expect(api.store.get('t1')!.tab.elements[5]).toMatchObject({ label: 'Their edit' });
    await idle();
    expect(await storedDrafts()).toHaveLength(0);
  });

  it('a flush that landed though the page never heard is removed on the next load, silently', async () => {
    const { documentId } = await closeWithAnEdit(() => {
      page.deaf = true;
    });
    expect(api.store.get('t1')!.rev).toBe(2);
    expect(await storedDrafts()).toHaveLength(1);

    page.gone = false;
    page.deaf = false;
    const next = await newPage();
    await next.apiLoadTabRevisioned('guest_1', documentId, 't1', null);
    expect(next.events).toEqual([]);
    expect(next.apiTakeDraftReplay('guest_1', documentId, 't1')).toBeNull();
    await idle();
    expect(await storedDrafts()).toHaveLength(0);
  });

  it('a flush that lands while the page lives on clears its draft', async () => {
    await closeWithAnEdit();
    expect(api.store.get('t1')!.rev).toBe(2);
    expect(await storedDrafts()).toHaveLength(0);
  });

  it('a draft the editor could not put on screen is removed, so no later load brings it back', async () => {
    const { documentId } = await closeWithAnEdit(() => {
      api.next.refuse = 'digest_mismatch';
      page.deaf = true;
    });
    page.gone = false;
    page.deaf = false;
    const next = await newPage();
    await next.apiLoadTabRevisioned('guest_1', documentId, 't1', null);
    next.apiDiscardDraft('guest_1', documentId, 't1');
    expect(next.apiTakeDraftReplay('guest_1', documentId, 't1')).toBeNull();
    await idle();
    expect(await storedDrafts()).toHaveLength(0);
  });

  it('another person in this browser never sees the draft', async () => {
    const { documentId } = await closeWithAnEdit(() => {
      api.next.refuse = 'digest_mismatch';
      page.deaf = true;
    });
    page.gone = false;
    page.deaf = false;
    const next = await newPage();
    await next.apiLoadTabRevisioned('guest_2', documentId, 't1', null);
    expect(next.events).toEqual([]);
    expect(next.apiTakeDraftReplay('guest_2', documentId, 't1')).toBeNull();
    expect(await storedDrafts()).toHaveLength(1);
  });
});
