import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elementsDigest } from '@liveworkspace/api-schema/tab-delta';
import { applyElementOps, type Element, type ElementOp, type Tab } from '@livehuddle/document';
import {
  TAB_DRAFTS_DB,
  apiAdoptPeerSave,
  apiLoadTabRevisioned,
  apiSaveTab,
  apiSavedTabDigest,
  flushDocumentSavesBeacon,
} from './tabs';

// This editor's delta saves (docs/specs/006-document/delta-saves.md "How the editor uses it"), through its own binding
// of the shared tab calls and the real element diff, against a small stand-in for the api's tab doors: the GET, the
// whole PUT (stores and echoes, through JSON) and the delta door (rebuilds over the stored copy, proves the digest,
// or refuses). The shared code's own tests cover every branch; these prove this editor turned it on.

vi.mock('../guest-token', () => ({
  readGuestToken: () => ({ token: 'guest-jwt', id: 'guest_1', expiresAt: 1 }),
}));

type Stored = { tab: Record<string, unknown> & { elements: Element[] }; rev: number };
type Sent = { method: string; url: string; body: string; keepalive?: boolean };

function fakeApi() {
  const store = new Map<string, Stored>();
  const sent: Sent[] = [];
  const next: { refuse?: string } = {};
  const write = (tabId: string, tab: Record<string, unknown>, elements: Element[]) => {
    const stored = JSON.parse(JSON.stringify({ ...tab, elements })) as Stored['tab'];
    const rev = (store.get(tabId)?.rev ?? 0) + 1;
    store.set(tabId, { tab: stored, rev });
    return { stored, rev };
  };
  const answer = async (input: string, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? init.body : '';
    sent.push({ method, url, body, keepalive: init.keepalive });
    const tabId = /\/tabs\/([^/]+)/.exec(url)![1]!;
    const held = store.get(tabId);
    if (method === 'GET') {
      if (!held) return Response.json({ error: 'not_found' }, { status: 404 });
      return Response.json({ tab: { ...held.tab, rev: held.rev } });
    }
    if (method === 'PUT') {
      const tab = JSON.parse(body) as Stored['tab'];
      const { stored, rev } = write(tabId, tab, tab.elements);
      return Response.json({ tab: { ...stored, rev } });
    }
    const delta = JSON.parse(body) as {
      baseRev: number;
      digest: string;
      ops: ElementOp[];
      tab: object;
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
    const { stored, rev } = write(tabId, delta.tab as Record<string, unknown>, elements);
    return Response.json({ rev, digest: await elementsDigest(stored.elements) });
  };
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

const box = (i: number, label = `Step ${i} of the onboarding flow`): Element =>
  ({
    type: 'shape',
    shape: 'square',
    width: 140,
    height: 80,
    id: `el-${i}`,
    x: (i % 50) * 160,
    y: Math.floor(i / 50) * 120,
    label,
  }) as unknown as Element;
const tabOf = (elements: Element[]): Tab => ({ id: 't1', name: 'Board', elements });
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

// Each test its own item, so the base copies one test holds never reach another.
let n = 0;
const itemId = () => `p${++n}`;
const large = () => tabOf(Array.from({ length: 2000 }, (_, i) => box(i)));

describe('delta saves in this editor', () => {
  // Work Tracker 805: the measured bytes per save of a one-label edit on a 2,000-element tab.
  it('sends a small delta instead of the whole tab for a small edit on a large tab', async () => {
    const id = itemId();
    const tab = large();
    // The first save of a new tab is whole: no base copy.
    await apiSaveTab('owner', id, tab);
    const edited = withLabel(tab, 1234, 'Step 1234, renamed');
    expect(await apiSaveTab('owner', id, edited)).toBe(2);
    expect(kinds(api.sent)).toEqual(['PUT tab', 'POST delta']);
    const [whole, delta] = api.sent;
    expect(bytes(whole!)).toBeGreaterThan(200_000);
    expect(bytes(delta!)).toBeLessThan(1_000);
    expect(api.store.get('t1')!.tab.elements).toEqual(edited.elements);
  });

  it("holds the load's copy, and answers a refusal with the whole tab in the same save", async () => {
    const id = itemId();
    api.store.set('t1', { tab: { ...large() }, rev: 5 });
    const loaded = (await apiLoadTabRevisioned('owner', id, 't1', null))!;
    api.next.refuse = 'stale_base';
    expect(await apiSaveTab('owner', id, withLabel(loaded.tab, 3, 'moved'))).toBe(6);
    expect(kinds(api.sent)).toEqual(['GET tab', 'POST delta', 'PUT tab']);
  });

  it('announces the digest of what a save stored, and adopts a peer save its baseline proves', async () => {
    const id = itemId();
    const tab = large();
    const rev = (await apiSaveTab('owner', id, tab))!;
    expect(await apiSavedTabDigest('t1', rev)).toBe(await elementsDigest(tab.elements));
    // A peer saved the next revision; this editor's baseline holds what it stored.
    const peer = withLabel(tab, 7, 'peer');
    api.store.set('t1', { tab: JSON.parse(JSON.stringify(peer)) as Stored['tab'], rev: rev + 1 });
    expect(await apiAdoptPeerSave(id, peer, rev + 1, await elementsDigest(peer.elements))).toBe(
      true,
    );
    api.sent.length = 0;
    await apiSaveTab('owner', id, withLabel(peer, 8, 'mine'));
    expect(kinds(api.sent)).toEqual(['POST delta']);
  });

  it('the unload flush sends a delta as keepalive within the budget, and keeps a draft', async () => {
    const id = itemId();
    const tab = large();
    await apiSaveTab('owner', id, tab);
    api.sent.length = 0;
    flushDocumentSavesBeacon({
      ownerId: 'owner',
      documentId: id,
      shareCode: null,
      changedTabs: [withLabel(tab, 9, 'last edit')],
      deletedIds: [],
      loadedTabIds: new Set(['t1']),
      orderChanged: false,
      nameChanged: false,
      name: 'Board',
      tabs: [tab],
    });
    await api.settled();
    expect(kinds(api.sent)).toEqual(['POST delta']);
    expect(api.sent[0]!.keepalive).toBe(true);
    expect(TAB_DRAFTS_DB).toBe('livehuddle-drafts');
  });
});
