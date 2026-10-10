import { afterEach, describe, expect, it, vi } from 'vitest';
import { OVERVIEW_TAB_BATCH } from '@livediagram/document-views';
import type { Element } from '@livediagram/document';
import { createShareLink } from '../db/share';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { getDocument } from '../db/documents';
import { answerOverview, parseViewQuery, type ParsedView } from './document-views-route';
import { handleDocuments } from './documents';
import { personTagFor } from '../person-tag';
import { makeTestRouteContext } from './test-route-context';

// Document views over REST on real SQLite (docs/specs/024-agents/document-views.md; blueprint "REST",
// R23 and R26): the gates, scope, refusals, headers and the Viewed event.

const OWNER = 'user_owner';
const box = (id: string, label: string, x = 0, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y: 0,
    width: 120,
    height: 60,
    label,
    ...extra,
  }) as Element;
const comment = {
  id: 'c1',
  text: 'Is this right?',
  createdAt: Date.UTC(2026, 8, 27),
  authorName: 'Sam',
  authorColor: '#000',
  authorId: 'user_sam_secret',
};
const ELEMENTS: Element[] = [
  {
    id: 'frame-1',
    type: 'shape',
    shape: 'frame',
    x: -20,
    y: -20,
    width: 600,
    height: 200,
    label: 'Services',
  } as Element,
  box('orders', 'Orders service', 0, { commentThread: { comments: [comment], resolved: false } }),
  box('payments', 'Payments', 300),
  {
    id: 'arrow-1',
    type: 'arrow',
    from: { kind: 'pinned', elementId: 'orders', anchor: 'e' },
    to: { kind: 'pinned', elementId: 'payments', anchor: 'w' },
    label: 'charge',
  } as Element,
  box('0bcd0001-x', 'Ambiguous one', 0, { y: 400 }),
  box('0bcd0002-x', 'Ambiguous two', 300, { y: 400 }),
];

type Who = { owner?: string; headers?: Record<string, string> };
const pending: Promise<unknown>[] = [];
const settled = () => Promise.all(pending.splice(0));

function call(db: SqliteD1, method: string, path: string, body?: unknown, who: Who = {}) {
  const owner = who.owner ?? OWNER;
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner,
      clerkUserId: owner,
      verifiedUserId: owner,
      body,
      headers: who.headers,
      waitUntil: (p) => void pending.push(p),
    }),
  );
}

async function setUp(extraTabs = 0, room?: unknown) {
  const db = sqliteD1({
    TELEMETRY_ENABLED: 'true',
    ...(room ? { DOCUMENT_ROOM: room } : {}),
  } as unknown as Partial<Env>);
  const tabs = [
    { id: 't1', name: 'Architecture', elements: ELEMENTS },
    ...Array.from({ length: extraTabs + 1 }, (_, i) => ({
      id: `t${i + 2}`,
      name: `Tab ${i + 2}`,
      elements: [box(`n${i}`, 'Note')],
    })),
  ];
  const created = await call(db, 'POST', '/api/documents', { id: 'D', name: 'Checkout', tabs });
  expect(created.status).toBe(201);
  return db;
}

const tabView = (db: SqliteD1, query: string, who: Who = {}) =>
  call(db, 'GET', `/api/documents/D/tabs/t1?${query}`, undefined, who);
const docView = (db: SqliteD1, query: string, who: Who = {}) =>
  call(db, 'GET', `/api/documents/D?${query}`, undefined, who);
const viewed = (db: SqliteD1) =>
  db.sql
    .prepare("SELECT type FROM events WHERE category = 'Agent' AND action = 'Viewed' ORDER BY type")
    .all()
    .map((r) => r.type);

let infos: unknown[][] = [];
afterEach(() => vi.restoreAllMocks());
const quiet = () => {
  infos = [];
  vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => void infos.push(args));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
};
const logged = (fingerprint: string) => infos.find((args) => args[0] === fingerprint)?.[1];

describe('tab views over REST (R23)', () => {
  it('answers the outline as text with the tab revision, logs it and counts it (R26)', async () => {
    quiet();
    const db = await setUp();
    const res = await tabView(db, 'view=outline');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('ETag')).toBe('W/"1"');
    const text = await res.text();
    expect(text.split('\n').slice(0, 4)).toEqual([
      'tab t1 "Architecture" · 6 elements: 4 boxes, 1 frame, 1 arrow · threads 1 open/1 · rev 1',
      'frame frame-1 "Services"',
      '  square orders "Orders service" comments=1 open → payments "charge"',
      '  square payments "Payments"',
    ]);
    expect(logged('[views] rendered outline')).toMatchObject({ doc: 'D', tab: 't1', elements: 6 });
    await settled();
    expect(viewed(db)).toEqual(['Outline']);
  });

  it('answers JSON with json=1, never carrying a person id', async () => {
    quiet();
    const db = await setUp();
    const res = await tabView(db, 'view=show&ref=orders&json=1');
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      ref: 'orders',
      kind: 'square',
      omitted: ['commentThread.comments[].authorId'],
    });
    expect(JSON.stringify(body)).not.toContain('user_sam_secret');
  });

  it('serves every tab view and counts each by name', async () => {
    quiet();
    const db = await setUp();
    for (const query of [
      'view=graph',
      'view=layout&coarse=1',
      'view=comments&all=1',
      'view=find&q=pay',
      'view=outline&style=1&budget=50&door=mcp',
    ]) {
      expect((await tabView(db, query)).status).toBe(200);
    }
    expect(logged('[views] budget outline')).toMatchObject({ budget: 50 });
    await settled();
    expect(viewed(db)).toEqual(['Comments', 'Find', 'Graph', 'Layout', 'Outline']);
  });

  it('leaves the plain tab read as it was', async () => {
    const db = await setUp();
    const res = await call(db, 'GET', '/api/documents/D/tabs/t1');
    expect(((await res.json()) as { tab: { id: string } }).tab.id).toBe('t1');
  });

  it('logs unknown kinds without dropping them', async () => {
    quiet();
    const db = await setUp();
    const data = JSON.stringify({
      elements: [
        ...ELEMENTS,
        { id: 'holo', type: 'hologram', label: 'x' },
        { ...box('blob', 'b'), shape: 'blob' },
      ],
    });
    db.sql.prepare("UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'").run(data);
    const text = await (await tabView(db, 'view=outline')).text();
    expect(text).toContain('? hologram holo "x"');
    expect(logged('[views] unknown kinds')).toEqual({ tab: 't1', hologram: 1, 'shape:blob': 1 });
  });
});

type Selection = { elementIds: string[]; name: string; color: string; mine: boolean };

// A room answering /selections, recording what it was asked.
function room(selections: Selection[] | 'down') {
  const asked: string[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (input: string) => {
        asked.push(input);
        if (selections === 'down') return new Response('no', { status: 500 });
        return Response.json({ selections });
      },
    }),
  };
  return { asked, binding };
}

describe('show selected over REST (R27)', () => {
  const mine = (elementIds: string[]): Selection => ({
    elementIds,
    name: 'Webber',
    color: '#000',
    mine: true,
  });

  it("shows what the owner has selected, never anyone else's selection, and logs the read", async () => {
    quiet();
    const r = room([mine(['payments']), { ...mine(['orders']), mine: false }]);
    const db = await setUp(0, r.binding);
    const res = await tabView(db, 'view=show&ref=selected');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('square payments "Payments"');
    expect(text).not.toContain('square orders');
    expect(r.asked).toHaveLength(1);
    expect(r.asked[0]).toContain('/selections?tab=t1&person=');
    expect(r.asked[0]).toContain(await personTagFor('D', OWNER));
    expect(logged('[views] selection')).toEqual({ doc: 'D', tab: 't1', read: true, count: 1 });
    await settled();
    expect(viewed(db)).toEqual(['Show']);
  });

  it('answers 404 when nothing is selected, or the room cannot be read', async () => {
    quiet();
    const empty = await tabView(await setUp(0, room([]).binding), 'view=show&ref=selected');
    expect(empty.status).toBe(404);
    expect(await empty.json()).toMatchObject({
      error: 'target_not_found',
      message: 'nothing is selected',
    });
    quiet();
    const down = await tabView(await setUp(0, room('down').binding), 'view=show&ref=selected');
    expect(down.status).toBe(404);
    expect(await down.json()).toMatchObject({ message: 'the selection could not be read' });
    expect(logged('[views] selection')).toEqual({ doc: 'D', tab: 't1', read: false, count: 0 });
  });

  it('asks the room for no other view, and for no other ref', async () => {
    quiet();
    const r = room([mine(['payments'])]);
    const db = await setUp(0, r.binding);
    expect((await tabView(db, 'view=outline')).status).toBe(200);
    expect((await tabView(db, 'view=show&ref=orders')).status).toBe(200);
    expect(r.asked).toEqual([]);
  });
});

describe('the lint over REST', () => {
  it('answers the lint as text with the tab revision, and counts it', async () => {
    quiet();
    const db = await setUp();
    const res = await tabView(db, 'view=lint');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('ETag')).toBe('W/"1"');
    const text = await res.text();
    expect(text.split('\n')[0]).toMatch(/^0 crossings · 0 behind · 0 overlaps · \d+×\d+ → /);
    expect(logged('[lint] run')).toMatchObject({
      documentId: 'D',
      tabId: 't1',
      source: 'tab',
      elements: 6,
    });
    await settled();
    expect(viewed(db)).toEqual(['Lint']);
  });

  it('answers the report as JSON with json=1', async () => {
    quiet();
    const db = await setUp();
    const res = await tabView(db, 'view=lint&json=1');
    expect(res.status).toBe(200);
    const report = (await res.json()) as { measures: { boxes: number }; findings: unknown[] };
    expect(report.measures.boxes).toBe(4);
    expect(Array.isArray(report.findings)).toBe(true);
  });

  it('stays behind the read gate', async () => {
    quiet();
    const db = await setUp();
    const stranger = { owner: 'user_stranger' };
    const plain = await call(db, 'GET', '/api/documents/D/tabs/t1', undefined, stranger);
    expect(plain.status).toBe(403);
    expect((await tabView(db, 'view=lint', stranger)).status).toBe(plain.status);
  });
});

describe('ref refusals over REST (R4, R5, E17, E18)', () => {
  it('answers 404 with the nearest refs for a ref that names nothing', async () => {
    quiet();
    const db = await setUp();
    const res = await tabView(db, 'view=show&ref=paymnts');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: 'target_not_found',
      input: 'paymnts',
      candidates: [{ ref: 'payments' }],
    });
    expect(logged('[views] ref refused')).toEqual({
      error: 'target_not_found',
      stale: false,
      candidates: 1,
    });
  });

  it('answers 400 with every candidate for an ambiguous prefix, marking a stale one', async () => {
    quiet();
    const db = await setUp();
    const res = await tabView(db, 'view=outline&only=0bcd');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: 'target_ambiguous',
      stale: true,
      candidates: [{ ref: '0bcd0001' }, { ref: '0bcd0002' }],
    });
  });

  it('refuses an arrow as a subtree (VW41)', async () => {
    quiet();
    const db = await setUp();
    const res = await tabView(db, 'view=layout&only=arrow-1');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'invalid_value',
      message: 'only takes an element, not an arrow',
    });
  });
});

describe('parseViewQuery (VW43)', () => {
  const parse = (query: string, scope: 'tab' | 'document' = 'tab') => {
    const url = new URL(`https://x/api?${query}`);
    return scope === 'tab' ? parseViewQuery(url, 'tab') : parseViewQuery(url, 'document');
  };
  const refusal = async (query: string, scope: 'tab' | 'document' = 'tab') => {
    const res = parse(query, scope);
    if (!(res instanceof Response)) throw new Error(query);
    expect(res.status).toBe(400);
    return res.json();
  };

  it('is null without a view, and reads every parameter', () => {
    expect(parse('json=1')).toBeNull();
    expect(parse('view=outline&budget=300&door=mcp&only=c991&style=1&json=1')).toEqual({
      request: {
        view: 'outline',
        budget: 300,
        door: 'mcp',
        only: 'c991',
        ref: undefined,
        q: undefined,
        coarse: undefined,
        style: true,
        all: undefined,
      },
      json: true,
    });
  });

  it('refuses views the door does not serve, naming diff and lint', async () => {
    quiet();
    expect(await refusal('view=diff')).toEqual({
      error: 'unknown_view',
      message: 'diff is computed by the CLI: livediagram tab diff',
    });
    expect(await refusal('view=lint', 'document')).toMatchObject({
      message: 'the lint is a tab view: GET …/tabs/:tabId?view=lint',
    });
    expect(parse('view=lint')).toEqual({ lint: true, json: false });
    expect(parse('view=lint&json=1')).toEqual({ lint: true, json: true });
    expect(await refusal('view=lint&budget=10')).toEqual({
      error: 'invalid_value',
      message: 'budget does not apply to view lint',
    });
    expect(await refusal('view=lint&json=2')).toEqual({
      error: 'invalid_value',
      message: 'json takes 1',
    });
    expect(await refusal('view=overview')).toMatchObject({
      error: 'unknown_view',
      message: expect.stringContaining('outline, graph'),
    });
    expect(await refusal('view=outline', 'document')).toEqual({
      error: 'unknown_view',
      message: 'view takes overview here',
    });
    expect(logged('[views] invalid request')).toEqual({ parameter: 'view', error: 'unknown_view' });
  });

  it('refuses every malformed parameter', async () => {
    quiet();
    const cases: [string, string][] = [
      ['view=outline&q=x', 'q does not apply to view outline'],
      ['view=outline&colour=1', 'colour does not apply to view outline'],
      ['view=outline&json=true', 'json takes 1'],
      ['view=outline&budget=0', 'budget takes a whole number from 1 to 1000000'],
      ['view=outline&budget=1.5', 'budget takes a whole number from 1 to 1000000'],
      ['view=outline&budget=1000001', 'budget takes a whole number from 1 to 1000000'],
      ['view=outline&door=web', 'door takes cli or mcp'],
      ['view=outline&only=', 'only takes a ref of 1 to 256 characters'],
      [`view=show&ref=${'a'.repeat(257)}`, 'ref takes a ref of 1 to 256 characters'],
      ['view=find&q=', 'q takes 1 to 200 characters'],
      [`view=find&q=${'a'.repeat(201)}`, 'q takes 1 to 200 characters'],
      ['view=show', 'view show needs ref'],
      ['view=find', 'view find needs q'],
    ];
    for (const [query, message] of cases)
      expect(await refusal(query)).toEqual({ error: 'invalid_value', message });
  });

  it('counts q in code points', () => {
    expect(parse(`view=find&q=${encodeURIComponent('😀'.repeat(200))}`)).not.toBeInstanceOf(
      Response,
    );
  });
});

describe('the overview over REST', () => {
  it('reads every tab a batch at a time and answers one line each', async () => {
    quiet();
    const db = await setUp(OVERVIEW_TAB_BATCH);
    const res = await docView(db, 'view=overview');
    expect(res.status).toBe(200);
    const lines = (await res.text()).split('\n');
    expect(lines[0]).toMatch(/^doc D "Checkout" · 10 tabs · edited just now$/);
    expect(lines[1]).toBe(
      '  tab t1 "Architecture" · 6 elements: 4 boxes, 1 frame, 1 arrow · threads 1 open/1 · rev 1',
    );
    expect(lines).toHaveLength(11);
    expect(logged('[views] overview')).toMatchObject({ doc: 'D', tabs: 10, batches: 2 });
    await settled();
    expect(viewed(db)).toEqual(['Overview']);
  });

  it('answers JSON with json=1 and a budget', async () => {
    quiet();
    const db = await setUp();
    const body = (await (await docView(db, 'view=overview&json=1&budget=40&door=mcp')).json()) as {
      document: Record<string, unknown>;
      elision: { command: string } | null;
    };
    expect(Object.keys(body.document).sort()).toEqual(['id', 'name', 'savedAt', 'tabs']);
    expect(body.elision?.command).toMatch(/^read_document \{"budget":\d+\}$/);
  });

  it('leaves the plain document read as it was', async () => {
    const db = await setUp();
    const res = await call(db, 'GET', '/api/documents/D');
    expect(((await res.json()) as { document: { id: string } }).document.id).toBe('D');
  });
});

describe('views at the edges of time', () => {
  it('warns of a slow render', async () => {
    quiet();
    const warns: unknown[][] = [];
    vi.mocked(console.warn).mockImplementation((...args: unknown[]) => void warns.push(args));
    const db = await setUp();
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 150));
    expect((await tabView(db, 'view=graph')).status).toBe(200);
    expect(warns.find((w) => w[0] === '[views] slow graph')?.[1]).toMatchObject({ elements: 6 });
  });

  it('leaves out a tab whose body is gone by the time the overview reads it', async () => {
    quiet();
    const db = await setUp();
    const document = (await getDocument(db.env, 'D'))!;
    const ghost = { ...document.tabs[0]!, id: 'ghost', name: 'Gone' };
    const parsed: ParsedView = { request: { view: 'outline' }, json: false };
    const ctx = makeTestRouteContext('GET', '/api/documents/D', { env: db.env, owner: OWNER });
    const all = await answerOverview(
      ctx,
      parsed,
      { ...document, tabs: [...document.tabs, ghost] },
      null,
    );
    expect((await all.text()).split('\n')).toHaveLength(3);
    const scoped = await answerOverview(ctx, parsed, { ...document, tabs: [ghost] }, 'ghost');
    expect(await scoped.text()).toBe('doc D "Checkout" · 0 tabs · edited just now');
  });
});

describe('views behind the read gate (E22, E23, E25)', () => {
  it('gives a stranger exactly what the plain read gives', async () => {
    quiet();
    const db = await setUp();
    const stranger = { owner: 'stranger' };
    const plainTab = await call(db, 'GET', '/api/documents/D/tabs/t1', undefined, stranger);
    expect(plainTab.status).toBeGreaterThanOrEqual(403);
    expect((await tabView(db, 'view=outline', stranger)).status).toBe(plainTab.status);
    expect((await docView(db, 'view=overview', stranger)).status).toBe(404);
    await settled();
    expect(viewed(db)).toEqual([]);
  });

  it('scopes a tab-scoped visitor to its tab, never reading the others', async () => {
    quiet();
    const db = await setUp();
    await createShareLink(db.env, 'D', 'SCOPED', 'view', 'never', 't2');
    const who = { owner: 'guest', headers: { 'X-Share-Code': 'SCOPED' } };
    expect((await tabView(db, 'view=outline', who)).status).toBe(404);
    const lines = (await (await docView(db, 'view=overview', who)).text()).split('\n');
    expect(lines.slice(1)).toEqual([
      '  tab t1 (out of scope)',
      '  tab t2 "Tab 2" · 1 element: 1 box · rev 1',
    ]);
    expect(logged('[views] overview')).toMatchObject({ batches: 1 });
  });

  it('answers a trashed document as the plain read does', async () => {
    quiet();
    const db = await setUp();
    expect((await call(db, 'DELETE', '/api/documents/D')).status).toBe(204);
    const plain = await call(db, 'GET', '/api/documents/D/tabs/t1');
    expect((await tabView(db, 'view=outline')).status).toBe(plain.status);
  });
});
