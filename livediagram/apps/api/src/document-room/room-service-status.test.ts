import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  STATUS_BIND_DELAY_MS,
  STATUS_POLL_MS,
  STATUS_SOURCES_MAX,
  type ServiceStatus,
} from '@livediagram/api-schema';
import type { PublicFetchResult } from '@liveworkspace/api-kit/public-fetch';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import type { ServerMessage } from '../types';
import { migrateDocumentSchema } from './document-schema';
import {
  checkStatusUrl,
  readStatusSources,
  RoomServiceStatus,
  SERVICE_STATUS_KEY,
  STATUS_CHECKS_AT_ONCE,
  STATUS_USER_AGENT,
  type StatusSources,
} from './room-service-status';

// The room's live status checks (docs/specs/009-elements/live-status.md "Polling"): one check per distinct URL per
// round however many people look, none with nobody connected or with polling off, the per-round cap, each session's
// tab scope, and the address guard before every fetch.

const T0 = 1_800_000_000_000;
const url = (n: number | string) => `https://status${n}.example.com/api/v2/status.json`;
const ok = (body = '{"status":{"indicator":"none"}}'): PublicFetchResult => ({
  ok: true,
  bytes: new TextEncoder().encode(body),
  url: 'x',
});

type Sock = { id: string; scope: string | null; joined: boolean; sent: ServerMessage[] };

function harness(opts: { enabled?: boolean; sources?: StatusSources } = {}) {
  const store = new Map<string, unknown>();
  const socks: Sock[] = [];
  let sources: StatusSources = opts.sources ?? { checked: [], overflow: [], byTab: new Map() };
  let now = T0;
  let enabled = opts.enabled ?? true;
  const fetched: string[] = [];
  let answer: (u: string) => Promise<PublicFetchResult> = async () => ok();
  const arm = vi.fn();
  const ws = (s: Sock) => s as unknown as WebSocket;
  const sock = (ws: WebSocket) => ws as unknown as Sock;
  const status = new RoomServiceStatus({
    storage: {
      get: (async (k: string) => store.get(k)) as never,
      put: (async (k: string, v: unknown) => void store.set(k, v)) as never,
      delete: (async (k: string) => store.delete(k)) as never,
    },
    enabled: () => enabled,
    sockets: () => socks.map(ws),
    sources: () => sources,
    scopeOf: (w) => sock(w).scope,
    joined: (w) => sock(w).joined,
    send: (w, payload) => void sock(w).sent.push(payload),
    arm,
    now: () => now,
    check: (u) => {
      fetched.push(u);
      return answer(u);
    },
  });
  const connect = (id: string, scope: string | null = null) => {
    const s: Sock = { id, scope, joined: true, sent: [] };
    socks.push(s);
    status.join(ws(s));
    return s;
  };
  return {
    status,
    store,
    socks,
    fetched,
    arm,
    connect,
    ws,
    setSources: (s: StatusSources) => void (sources = s),
    setNow: (t: number) => void (now = t),
    setEnabled: (e: boolean) => void (enabled = e),
    answerWith: (fn: (u: string) => Promise<PublicFetchResult>) => void (answer = fn),
    // Fire the alarm at `t` (the room passes Date.now()).
    fire: async (t: number) => {
      now = t;
      await status.alarm(t);
    },
  };
}

const sourcesOf = (tabs: Record<string, string[]>): StatusSources => {
  const all = [...new Set(Object.values(tabs).flat())];
  return {
    checked: all.slice(0, STATUS_SOURCES_MAX),
    overflow: all.slice(STATUS_SOURCES_MAX),
    byTab: new Map(Object.entries(tabs)),
  };
};
const statusesIn = (s: Sock) =>
  s.sent.map(
    (m) => (m as { op: { kind: string; statuses: Record<string, ServiceStatus> } }).op.statuses,
  );

describe('RoomServiceStatus rounds', () => {
  it('checks each distinct URL once a round, however many sessions look and tabs bind it', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1), url(2)], t2: [url(1)] }) });
    const viewers = Array.from({ length: 10 }, (_, i) => h.connect(`v${i}`));
    // Nothing checked yet: nothing to send, and a round due now.
    expect(viewers.every((v) => v.sent.length === 0)).toBe(true);
    expect(h.status.at).toBe(T0);
    await h.fire(T0 + 1_000);
    expect(h.fetched.sort()).toEqual([url(1), url(2)]);
    for (const v of viewers) {
      expect(statusesIn(v)).toEqual([
        {
          [url(1)]: { state: 'up', checkedAt: T0 + 1_000 },
          [url(2)]: { state: 'up', checkedAt: T0 + 1_000 },
        },
      ]);
    }
    expect(h.status.at).toBe(T0 + 1_000 + STATUS_POLL_MS);
    expect(h.store.get(SERVICE_STATUS_KEY)).toEqual({
      [url(1)]: { state: 'up', checkedAt: T0 + 1_000 },
      [url(2)]: { state: 'up', checkedAt: T0 + 1_000 },
    });
  });

  it('never checks a URL twice within a minute, whatever else wakes the alarm', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    h.connect('a');
    await h.fire(T0 + 1_000);
    expect(h.fetched).toHaveLength(1);
    // An alarm before the round is due (another duty's) runs nothing.
    await h.fire(T0 + 30_000);
    expect(h.fetched).toHaveLength(1);
    await h.fire(T0 + 1_000 + STATUS_POLL_MS);
    expect(h.fetched).toHaveLength(2);
  });

  it('runs no round with polling off: nothing sent, armed or fetched', async () => {
    const h = harness({ enabled: false, sources: sourcesOf({ t1: [url(1)] }) });
    const a = h.connect('a');
    h.status.noteWrite();
    await h.fire(T0 + STATUS_POLL_MS);
    expect(h.status.at).toBeNull();
    expect(h.arm).not.toHaveBeenCalled();
    expect(h.fetched).toEqual([]);
    expect(a.sent).toEqual([]);
  });

  it('turned off between rounds, it stops checking', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    h.connect('a');
    h.setEnabled(false);
    await h.fire(T0 + 1_000);
    expect(h.fetched).toEqual([]);
    expect(h.status.at).toBeNull();
  });

  it('fetches nothing and sets no round for an idle document', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    // A save with nobody connected (an API write) brings no round.
    h.status.noteWrite();
    expect(h.status.at).toBeNull();
    // The last session leaves before its round: the round goes, and the alarm is re-armed without it.
    const a = h.connect('a');
    expect(h.status.at).toBe(T0);
    h.socks.length = 0;
    h.status.left(h.ws(a));
    expect(h.status.at).toBeNull();
    expect(h.arm).toHaveBeenCalledTimes(2);
    // An alarm that still fires finds nobody: no fetch.
    await h.status.alarm(T0 + 1_000);
    expect(h.fetched).toEqual([]);
  });

  it('a round with nobody connected any more fetches nothing and sets no next round', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    h.connect('a');
    h.socks.length = 0;
    await h.fire(T0 + 1_000);
    expect(h.fetched).toEqual([]);
    expect(h.status.at).toBeNull();
  });

  it('keeps the round while another session stays', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    const a = h.connect('a');
    h.connect('b');
    h.status.left(h.ws(a));
    expect(h.status.at).toBe(T0);
    // Nothing due: leaving changes nothing.
    const idle = harness();
    idle.status.left(idle.ws(idle.connect('x')));
    expect(idle.arm).not.toHaveBeenCalled();
  });

  it('a save brings a round within seconds that checks only the URL not checked yet', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    h.connect('a');
    await h.fire(T0 + 1_000);
    h.setNow(T0 + 10_000);
    h.setSources(sourcesOf({ t1: [url(1), url(2)] }));
    h.status.noteWrite();
    expect(h.status.at).toBe(T0 + 10_000 + STATUS_BIND_DELAY_MS);
    // A second save never pushes it back.
    h.setNow(T0 + 11_000);
    h.status.noteWrite();
    expect(h.status.at).toBe(T0 + 10_000 + STATUS_BIND_DELAY_MS);
    await h.fire(T0 + 13_000);
    expect(h.fetched).toEqual([url(1), url(2)]);
    // The next round is url(1)'s, a minute after its check.
    expect(h.status.at).toBe(T0 + 1_000 + STATUS_POLL_MS);
  });

  it('a save that binds nothing new checks nothing and sends nothing', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    const a = h.connect('a');
    await h.fire(T0 + 1_000);
    a.sent.length = 0;
    h.status.noteWrite();
    await h.fire(T0 + 1_000 + STATUS_BIND_DELAY_MS);
    expect(h.fetched).toHaveLength(1);
    expect(a.sent).toEqual([]);
  });

  it('checks at most STATUS_SOURCES_MAX URLs, and sends the rest as Unknown', async () => {
    const urls = Array.from({ length: STATUS_SOURCES_MAX + 5 }, (_, i) => url(i));
    const h = harness({ sources: sourcesOf({ t1: urls }) });
    const a = h.connect('a');
    await h.fire(T0 + 1_000);
    expect(h.fetched).toEqual(urls.slice(0, STATUS_SOURCES_MAX));
    // The ones past the cap are Unknown from the hello on; the round adds the checked ones.
    expect(Object.keys(statusesIn(a)[0]!)).toEqual(urls.slice(STATUS_SOURCES_MAX));
    const sent = statusesIn(a)[1]!;
    expect(Object.keys(sent)).toHaveLength(urls.length);
    expect(sent[url(STATUS_SOURCES_MAX)]).toEqual({
      state: 'unknown',
      checkedAt: T0 + 1_000,
      reason: 'too_many_sources',
    });
    expect(Object.keys(h.store.get(SERVICE_STATUS_KEY) as object)).toHaveLength(STATUS_SOURCES_MAX);
  });

  it(`runs at most ${STATUS_CHECKS_AT_ONCE} checks at once`, async () => {
    const h = harness({ sources: sourcesOf({ t1: Array.from({ length: 10 }, (_, i) => url(i)) }) });
    let inFlight = 0;
    let most = 0;
    h.answerWith(async () => {
      most = Math.max(most, ++inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return ok();
    });
    h.connect('a');
    await h.fire(T0 + 1_000);
    expect(h.fetched).toHaveLength(10);
    expect(most).toBe(STATUS_CHECKS_AT_ONCE);
  });

  it('runs one round at a time when the alarm is asked twice', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    let release = () => {};
    h.answerWith(() => new Promise((r) => (release = () => r(ok()))));
    h.connect('a');
    const first = h.status.alarm(T0 + 1_000);
    // A save during the round brings the next one forward; its alarm, still inside the round, waits on it.
    h.status.noteWrite();
    const second = h.status.alarm(T0 + 1_000 + STATUS_BIND_DELAY_MS);
    release();
    await Promise.all([first, second]);
    expect(h.fetched).toHaveLength(1);
  });

  it('sends each session only the URLs bound on the tab its link may see', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)], t2: [url(2)] }) });
    const all = h.connect('all');
    const one = h.connect('one', 't2');
    const none = h.connect('none', 't3');
    const waiting = h.connect('waiting');
    waiting.joined = false;
    await h.fire(T0 + 1_000);
    expect(Object.keys(statusesIn(all)[0]!)).toEqual([url(1), url(2)]);
    expect(Object.keys(statusesIn(one)[0]!)).toEqual([url(2)]);
    expect(none.sent).toEqual([]);
    // A socket that hasn't said hello hears it on its hello.
    expect(waiting.sent).toEqual([]);
    expect(all.sent[0]).toMatchObject({
      kind: 'op',
      from: 'system',
      op: { kind: 'service-status' },
    });
  });

  it('greets a joining session with the states kept, and checks again only what is due', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    h.connect('a');
    await h.fire(T0 + 1_000);
    h.setNow(T0 + 20_000);
    const b = h.connect('b');
    expect(statusesIn(b)).toEqual([{ [url(1)]: { state: 'up', checkedAt: T0 + 1_000 } }]);
    expect(h.status.at).toBe(T0 + 1_000 + STATUS_POLL_MS);
  });

  it('sends nothing on join for a document without bindings, or with polling off', () => {
    const h = harness();
    expect(h.connect('a').sent).toEqual([]);
    expect(h.status.at).toBeNull();
  });

  it('drops a URL no shape is bound to any more, and the key with the last one', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1), url(2)] }) });
    h.connect('a');
    await h.fire(T0 + 1_000);
    h.setSources(sourcesOf({ t1: [url(1)] }));
    h.status.noteWrite();
    await h.fire(T0 + 5_000);
    expect(Object.keys(h.store.get(SERVICE_STATUS_KEY) as object)).toEqual([url(1)]);
    h.setSources(sourcesOf({}));
    h.status.noteWrite();
    await h.fire(T0 + 10_000);
    expect(h.store.has(SERVICE_STATUS_KEY)).toBe(false);
    expect(h.status.at).toBeNull();
  });

  it('reduces each answer to its state, and never fetches a stored URL the address check refuses', async () => {
    const h = harness({
      sources: sourcesOf({ t1: [url('down'), url('broken'), 'https://localhost/health'] }),
    });
    h.answerWith(async (u) => {
      if (u === url('broken')) throw new Error('boom');
      return { ok: false, reason: 'http_status', status: 503, url: u };
    });
    const a = h.connect('a');
    await h.fire(T0 + 1_000);
    expect(h.fetched).toEqual([url('down'), url('broken')]);
    expect(statusesIn(a)[0]).toEqual({
      [url('down')]: {
        state: 'down',
        checkedAt: T0 + 1_000,
        reason: 'http_status',
        httpStatus: 503,
      },
      [url('broken')]: { state: 'down', checkedAt: T0 + 1_000, reason: 'unreachable' },
      'https://localhost/health': { state: 'unknown', checkedAt: T0 + 1_000, reason: 'refused' },
    });
  });

  it('restores the kept states after a wake, and the round they are due while sessions stay', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1), url(2)] }) });
    h.store.set(SERVICE_STATUS_KEY, {
      [url(1)]: { state: 'up', checkedAt: T0 },
      [url(2)]: { state: 'down', checkedAt: T0 - 10_000 },
      junk: { state: 'up' },
    });
    await h.status.restore();
    // Nobody connected: no round.
    expect(h.status.at).toBeNull();
    h.connect('a');
    await h.status.restore();
    expect(h.status.at).toBe(T0 - 10_000 + STATUS_POLL_MS);
    await h.fire(T0 - 10_000 + STATUS_POLL_MS);
    expect(h.fetched).toEqual([url(2)]);
  });

  it('restores nothing from an empty or malformed key', async () => {
    const h = harness();
    h.store.set(SERVICE_STATUS_KEY, 'nonsense');
    await h.status.restore();
    expect(h.status.at).toBeNull();
    const empty = harness();
    await empty.status.restore();
    expect(empty.status.at).toBeNull();
  });

  it('forgets every state for a purge', async () => {
    const h = harness({ sources: sourcesOf({ t1: [url(1)] }) });
    h.connect('a');
    await h.fire(T0 + 1_000);
    h.status.forget();
    expect(h.status.at).toBeNull();
    // A later join finds nothing kept, so its URL is due again at once.
    h.connect('b');
    expect(h.status.at).toBe(T0 + 1_000);
  });
});

describe('readStatusSources', () => {
  function documentDb() {
    const db = new DatabaseSync(':memory:');
    const sql = nodeItemSql(db);
    migrateDocumentSchema((q) => sql.exec(q));
    db.exec(`INSERT INTO document (id, saved_at, created_at) VALUES ('d1', 1, 1), ('d2', 1, 1)`);
    let order = 0;
    const tab = (doc: string, id: string, data: unknown) => {
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      db.prepare('INSERT OR IGNORE INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, 1)').run(
        id,
        id,
        text,
      );
      db.prepare(
        'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, 1)',
      ).run(doc, id, order++);
    };
    return { sql: sql as unknown as SqlStorage, tab };
  }
  const shape = (id: string, statusUrl?: string) => ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...(statusUrl ? { statusUrl } : {}),
  });

  it('finds the distinct bound URLs in tab then element order, with each tab its own', () => {
    const { sql, tab } = documentDb();
    tab('d1', 'a', { elements: [shape('s1', url(2)), shape('s2', url(1)), shape('s3')] });
    tab('d1', 'plain', { elements: [shape('s4')] });
    tab('d1', 'b', { elements: [shape('s5', url(1)), shape('s6', url(3)), null, 'x'] });
    // Not a shape: never a source.
    tab('d1', 'c', { elements: [{ id: 't', type: 'text', statusUrl: url(9) }] });
    // Unparseable, or with no element list: skipped.
    tab('d1', 'bad', '{"statusUrl": broken');
    tab('d1', 'odd', { statusUrl: url(8) });
    // Another document's tab, and a tab linked into both.
    tab('d2', 'other', { elements: [shape('s7', url(7))] });
    tab('d1', 'other', {});
    const sources = readStatusSources(sql, 'd1');
    expect(sources.checked).toEqual([url(2), url(1), url(3), url(7)]);
    expect(sources.overflow).toEqual([]);
    expect([...sources.byTab]).toEqual([
      ['a', [url(2), url(1)]],
      ['b', [url(1), url(3)]],
      ['other', [url(7)]],
    ]);
  });

  it('splits the URLs past the cap off as overflow', () => {
    const { sql, tab } = documentDb();
    const many = Array.from({ length: STATUS_SOURCES_MAX + 2 }, (_, i) => shape(`s${i}`, url(i)));
    tab('d1', 'a', { elements: many });
    const sources = readStatusSources(sql, 'd1');
    expect(sources.checked).toHaveLength(STATUS_SOURCES_MAX);
    expect(sources.overflow).toEqual([url(STATUS_SOURCES_MAX), url(STATUS_SOURCES_MAX + 1)]);
  });

  it('scans a document of ten 1 MB tabs within budget, bound or not', () => {
    const bound = documentDb();
    const plain = documentDb();
    for (let t = 0; t < 10; t++) {
      const elements = Array.from({ length: 2_500 }, (_, i) => ({
        ...shape(`e${i}`, i % 100 === 0 ? url(`${t}-${i}`) : undefined),
        label: 'x'.repeat(320),
      }));
      bound.tab('d1', `t${t}`, { elements });
      plain.tab('d1', `t${t}`, { elements: elements.map(({ statusUrl: _, ...e }) => e) });
    }
    let found = 0;
    const plainMs = cpuMsOf(
      () => void (found += readStatusSources(plain.sql, 'd1').checked.length),
    );
    const boundMs = cpuMsOf(
      () => void (found += readStatusSources(bound.sql, 'd1').checked.length),
    );
    console.info('[perf] status scan, 10 MB', { plainMs, boundMs });
    expect(found).toBe(STATUS_SOURCES_MAX);
    // Without a binding SQLite skips every tab and nothing is parsed; with them each tab is parsed once.
    expect(plainMs).toBeLessThan(cpuBudgetMs(30));
    expect(boundMs).toBeLessThan(cpuBudgetMs(150));
  });

  it('finds nothing in a document without bindings', () => {
    const { sql, tab } = documentDb();
    tab('d1', 'a', { elements: [shape('s1')] });
    expect(readStatusSources(sql, 'd1')).toEqual({ checked: [], overflow: [], byTab: new Map() });
  });
});

describe('checkStatusUrl', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The resolver (DNS over HTTPS) answers `address` for A and nothing for AAAA; the target answers `target`.
  function stubNetwork(address: string, target: () => Response) {
    const asked: Request[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      const at = new URL(req.url);
      if (at.searchParams.has('name')) {
        const type = at.searchParams.get('type');
        return Response.json({ Answer: type === 'A' ? [{ type: 1, data: address }] : [] });
      }
      asked.push(req);
      return target();
    });
    return asked;
  }

  it('resolves the host first and refuses a private address without fetching it', async () => {
    const asked = stubNetwork('10.0.0.5', () => new Response('{}'));
    expect(await checkStatusUrl(url(1))).toMatchObject({ ok: false, reason: 'private_address' });
    expect(asked).toEqual([]);
  });

  it('follows no redirect, and names itself without credentials', async () => {
    const asked = stubNetwork(
      '93.184.216.34',
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'https://elsewhere.example.com/' },
        }),
    );
    expect(await checkStatusUrl(url(1))).toMatchObject({
      ok: false,
      reason: 'too_many_redirects',
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]!.headers.get('User-Agent')).toBe(STATUS_USER_AGENT);
    expect(asked[0]!.headers.get('Cookie')).toBeNull();
    expect(asked[0]!.headers.get('Authorization')).toBeNull();
  });

  it('reads a public answer', async () => {
    stubNetwork('93.184.216.34', () => Response.json({ status: 'pass' }));
    expect(await checkStatusUrl(url(1))).toMatchObject({ ok: true });
  });
});

describe('the document room', () => {
  afterEach(() => vi.unstubAllGlobals());

  type FakeSocket = { sent: string[]; attachment: unknown };

  // A room on its own SQLite with one document whose two tabs bind one URL, and sockets that record what they hear.
  async function openRoom(env: Record<string, string>) {
    const { DocumentRoom } = await import('./document-room');
    const db = new DatabaseSync(':memory:');
    const sql = nodeItemSql(db);
    migrateDocumentSchema((q) => sql.exec(q));
    db.exec(`INSERT INTO document (id, saved_at, created_at) VALUES ('d1', 1, 1)`);
    const data = JSON.stringify({
      elements: [
        {
          id: 's',
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 9,
          height: 9,
          statusUrl: url(1),
        },
      ],
    });
    for (const [i, id] of ['t1', 't2'].entries()) {
      db.prepare('INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, 1)').run(
        id,
        id,
        data,
      );
      db.prepare(
        'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, 1)',
      ).run('d1', id, i);
    }
    const kv = new Map<string, unknown>();
    const sockets: FakeSocket[] = [];
    const wsOf = new Map<FakeSocket, WebSocket>();
    const ws = (s: FakeSocket) => {
      if (!wsOf.has(s)) {
        wsOf.set(s, {
          send: (d: string) => void s.sent.push(d),
          serializeAttachment: (v: unknown) => void (s.attachment = v),
          deserializeAttachment: () => s.attachment,
        } as unknown as WebSocket);
      }
      return wsOf.get(s)!;
    };
    const state = {
      acceptWebSocket: () => {},
      getWebSockets: () => sockets.map(ws),
      storage: {
        sql,
        transactionSync: <T>(fn: () => T) => fn(),
        get: async (k: string) => kv.get(k),
        put: async (k: string, v: unknown) => void kv.set(k, v),
        delete: async (k: string) => kv.delete(k),
        list: async () => new Map(),
        setAlarm: async () => {},
        deleteAlarm: async () => {},
      },
      blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
      waitUntil: () => {},
    };
    const room = new DocumentRoom(state as unknown as DurableObjectState, env as never);
    // The constructor's restore runs behind a few storage reads.
    await new Promise((r) => setTimeout(r, 0));
    const join = (id: string) => {
      const s: FakeSocket = {
        sent: [],
        attachment: { presenceId: id, verifiedRole: 'view', presence: null },
      };
      sockets.push(s);
      room.webSocketMessage(
        ws(s),
        JSON.stringify({ kind: 'hello', participant: { name: id, color: '#abc', tabId: 't1' } }),
      );
      return s;
    };
    const heard = (s: FakeSocket) =>
      s.sent
        .map((f) => JSON.parse(f) as { op?: { kind?: string } })
        .filter((f) => f.op?.kind === 'service-status');
    return { room, join, heard, kv };
  }

  function stubStatusPage() {
    const checks: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      if (new URL(req.url).searchParams.has('name')) {
        return Response.json({ Answer: [{ type: 1, data: '93.184.216.34' }] });
      }
      checks.push(req.url);
      return Response.json({ status: { indicator: 'minor' } });
    });
    return checks;
  }

  it('checks a URL bound on two tabs once for three viewers, and tells each one', async () => {
    const checks = stubStatusPage();
    const { room, join, heard, kv } = await openRoom({ LIVE_STATUS_ENABLED: 'true' });
    const viewers = [join('a'), join('b'), join('c')];
    expect(room.serviceStatus.at).not.toBeNull();
    await room.alarm();
    expect(checks).toEqual([url(1)]);
    for (const v of viewers) {
      expect(heard(v)).toHaveLength(1);
      expect(heard(v)[0]).toMatchObject({
        op: { statuses: { [url(1)]: { state: 'degraded', reason: 'reported' } } },
      });
    }
    expect(kv.has(SERVICE_STATUS_KEY)).toBe(true);
    // A later joiner hears the kept state on its hello, with no new check.
    expect(heard(join('d'))).toHaveLength(1);
    expect(checks).toHaveLength(1);
  });

  it('with LIVE_STATUS_ENABLED unset, sends and fetches nothing', async () => {
    const checks = stubStatusPage();
    const { room, join, heard, kv } = await openRoom({});
    const a = join('a');
    expect(room.serviceStatus.at).toBeNull();
    await room.alarm();
    expect(checks).toEqual([]);
    expect(heard(a)).toEqual([]);
    expect(kv.has(SERVICE_STATUS_KEY)).toBe(false);
  });
});
