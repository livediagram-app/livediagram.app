// The api's tab doors as the editor's delta-save tests meet them (docs/specs/006-document/delta-saves.md): one
// in-memory store behind the GET, the whole PUT (stores and echoes, through JSON as D1 does) and the delta door
// (rebuilds over the stored copy, proves the digest, or refuses), and the board fixtures those tests draw with. Test
// support only: shared by the delta, peer and draft tests.
import { vi } from 'vitest';
import { elementsDigest } from '@liveworkspace/api-schema/tab-delta';
import { applyElementOps, type Element, type ElementOp, type Tab } from '@livediagram/document';

export type Stored = { tab: Record<string, unknown> & { elements: Element[] }; rev: number };
export type Sent = {
  method: string;
  url: string;
  body: string;
  headers: Headers;
  keepalive?: boolean;
};

// The api's tab doors over one in-memory store, keyed by tab id.
export function fakeApi() {
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

export const box = (i: number, label = `Step ${i}`): Element =>
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

export const tabOf = (elements: Element[], id = 't1'): Tab => ({ id, name: 'Board', elements });

export const withLabel = (tab: Tab, i: number, label: string): Tab => ({
  ...tab,
  elements: tab.elements.map((el, j) => (j === i ? { ...el, label } : el)),
});

export const bytes = (s: Sent) => new TextEncoder().encode(s.body).byteLength;
export const kinds = (sent: Sent[]) =>
  sent.map((s) => `${s.method} ${s.url.endsWith('/delta') ? 'delta' : 'tab'}`);
