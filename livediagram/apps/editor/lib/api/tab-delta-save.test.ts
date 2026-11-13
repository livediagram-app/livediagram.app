import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elementsDigest, planTabDelta } from '@liveworkspace/api-schema/tab-delta';
import {
  applyElementOps,
  diffToElementOps,
  type Element,
  type ElementOp,
  type Tab,
} from '@livediagram/document';
import { apiLoadTabRevisioned, apiSaveTab, flushDocumentSavesBeacon } from './tabs';
import { offlineSaveTab } from '../offline/offline-store';

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

type Stored = { tab: Record<string, unknown> & { elements: Element[] }; rev: number };
type Sent = { method: string; url: string; body: string; headers: Headers; keepalive?: boolean };

// The api's tab doors over one in-memory store, keyed by tab id.
function fakeApi() {
  const store = new Map<string, Stored>();
  const sent: Sent[] = [];
  // Set to answer the next delta with a refusal or an error, or to merge something into the next write.
  const next: { refuse?: string; status?: number; merge?: (els: Element[]) => Element[] } = {};
  const write = (tabId: string, tab: Record<string, unknown>, elements: Element[]) => {
    const merged = next.merge ? next.merge(elements) : elements;
    next.merge = undefined;
    // What the api stores goes through JSON, as D1 does.
    const stored = JSON.parse(JSON.stringify({ ...tab, elements: merged })) as Stored['tab'];
    const rev = (store.get(tabId)?.rev ?? 0) + 1;
    store.set(tabId, { tab: stored, rev });
    return { stored, rev };
  };
  const answer = async (input: string, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? init.body : '';
    sent.push({ method, url, body, headers: new Headers(init.headers), keepalive: init.keepalive });
    const tabId = /\/tabs\/([^/]+)/.exec(url)![1]!;
    const held = store.get(tabId);
    if (method === 'GET') {
      if (!held) return Response.json({ error: 'not_found' }, { status: 404 });
      return Response.json({ tab: { ...held.tab, documentId: 'd1', rev: held.rev } });
    }
    if (method === 'PUT') {
      const tab = JSON.parse(body) as Record<string, unknown> & { elements: Element[] };
      const { stored, rev } = write(tabId, tab, tab.elements);
      return Response.json({ tab: { ...stored, documentId: 'd1', rev } });
    }
    // POST .../delta
    if (next.status) {
      const status = next.status;
      next.status = undefined;
      return Response.json({ error: 'tab_busy' }, { status });
    }
    const delta = JSON.parse(body) as {
      baseRev: number;
      digest: string;
      ops: ElementOp[];
      tab: Record<string, unknown>;
    };
    const refuse = (reason: string) =>
      Response.json({ error: 'delta_refused', reason }, { status: 409 });
    if (next.refuse) {
      const reason = next.refuse;
      next.refuse = undefined;
      return refuse(reason);
    }
    if (!held) return refuse('no_base');
    if (held.rev !== delta.baseRev) return refuse('stale_base');
    const elements = applyElementOps(held.tab.elements, delta.ops);
    if ((await elementsDigest(elements)) !== delta.digest) return refuse('digest_mismatch');
    const { stored, rev } = write(tabId, delta.tab, elements);
    return Response.json({ rev, digest: await elementsDigest(stored.elements) });
  };
  // Every request in flight, so a test can wait for the unload flush's unawaited ones and what they send next.
  const inflight: Promise<unknown>[] = [];
  const fetch = vi.fn((input: string, init?: RequestInit) => {
    const res = answer(input, init);
    inflight.push(res);
    return res;
  });
  const settled = async () => {
    let seen;
    do {
      seen = inflight.length;
      await Promise.allSettled(inflight);
      await new Promise((resolve) => setTimeout(resolve, 0));
    } while (inflight.length !== seen);
  };
  return { store, sent, next, fetch, settled };
}

const box = (i: number, label = `Step ${i}`): Element =>
  ({
    id: `el-${i}`,
    type: 'rectangle',
    x: (i % 50) * 160,
    y: Math.floor(i / 50) * 120,
    width: 140,
    height: 80,
    label,
    fill: '#ffffff',
    stroke: '#1f2937',
  }) as unknown as Element;

const tabOf = (elements: Element[], id = 't1'): Tab => ({ id, name: 'Board', elements });

const withLabel = (tab: Tab, i: number, label: string): Tab => ({
  ...tab,
  elements: tab.elements.map((el, j) => (j === i ? { ...el, label } : el)),
});

const bytes = (s: Sent) => new TextEncoder().encode(s.body).byteLength;
const kinds = (sent: Sent[]) =>
  sent.map((s) => `${s.method} ${s.url.endsWith('/delta') ? 'delta' : 'tab'}`);

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
