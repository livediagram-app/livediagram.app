// Sheet sources over HTTP (liveworkspace/docs/specs/004-index/sheet-sources.md): a range read on the reader's own access
// only (Work Tracker 940), the door it calls on the plan app's key, the watch only with the reader item's own grant,
// and the change signal relayed to each watcher's app.
import type { SheetRangeRead } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness, type AppCall } from './test-support';

useHarness({
  INDEX_KEY_LIVEDOCUMENTS: 'lvd-key',
  APP_ORIGIN_LIVEDOCUMENTS: 'https://livedocuments.app',
});

const RANGE = { r1: 'r0001', c1: 'c0001', r2: 'r0009', c2: 'c0004' };
const READ = {
  sheetName: 'Budget',
  tabId: 'tab-1',
  range: RANGE,
  a1: 'A1:D9',
  table: { categories: ['Q1'], series: [{ name: 'Sales', values: [3] }] },
};
const SHEETS = [
  { id: 's1', name: 'Budget', tabId: 'tab-1', a1: 'A1:D9' },
  { id: 's2', name: 'Hiring', tabId: 'tab-2', a1: 'A1:B4' },
];

// The plan app answers its doors as a sheet app would.
function sheetApp(answer: (c: AppCall) => Response | undefined = () => undefined) {
  h.appAnswer = (c) => {
    const given = answer(c);
    if (given) return given;
    if (c.url.endsWith('/sheet-range')) return Response.json(READ);
    if (c.url.endsWith('/sheets')) return Response.json({ sheets: SHEETS });
    return new Response(null, { status: 202 });
  };
}

const readRange = (
  auth: string | null,
  planId: string,
  input: Record<string, unknown> = { sheetId: 's1', a1: 'A1:D9' },
  headers: Record<string, string> = {},
) => call(`/items/${planId}/sheet-range`, { method: 'POST', auth, body: input, headers });

async function grantFor(auth: string, itemId: string, code?: string): Promise<string> {
  const res = await call(`/items/${itemId}/grant`, {
    method: 'POST',
    auth,
    headers: code ? { 'X-Share-Code': code } : {},
  });
  expect(res.status).toBe(200);
  return (await body<{ grant: string }>(res)).grant;
}

async function shareLink(auth: string, itemId: string, input: Record<string, unknown> = {}) {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: input });
  expect(res.status).toBe(201);
  return (await body<{ link: { code: string } }>(res)).link.code;
}

// Ada's plan and document.
async function setup() {
  const ada = await person('user_ada');
  const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Q4 Metrics' });
  const doc = await makeItem(ada.auth, { app: 'livedocuments', title: 'Weekly' });
  await settle();
  h.appCalls = [];
  sheetApp();
  return { ada, plan, doc };
}

const doorCalls = () => h.appCalls.filter((c) => /\/sheet-range$|\/sheets$/.test(c.url));

describe('reading a range', () => {
  it("reads it through the plan app's door on its own key, answering the read with the plan's name", async () => {
    const { ada, plan } = await setup();
    const res = await readRange(ada.auth, plan.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const read = await body<SheetRangeRead>(res);
    expect(read).toEqual({
      ...READ,
      itemId: plan.id,
      itemName: 'Q4 Metrics',
      sheetId: 's1',
      readAt: expect.any(Number),
    });
    const [door] = doorCalls();
    expect(door!.url).toBe(`https://liveplanner.app/api/internal/items/${plan.id}/sheet-range`);
    expect(door!.headers.get('Authorization')).toBe('Bearer lp-key');
    expect(door!.body).toEqual({ sheetId: 's1', a1: 'A1:D9' });
  });

  it("reads with a team member's access and a link the reader opened before", async () => {
    const { ada, plan } = await setup();
    const code = await shareLink(ada.auth, plan.id, { level: 'view' });
    const bo = await person('user_bo');
    expect(
      (await call(`/share/${code}`, { auth: bo.auth, headers: { 'X-Share-Code': code } })).status,
    ).toBe(200);
    expect((await readRange(bo.auth, plan.id)).status).toBe(200);
  });

  it('answers as missing to anyone who cannot open the plan themselves', async () => {
    const { plan } = await setup();
    const cy = await person('user_cy');
    expect((await readRange(cy.auth, plan.id)).status).toBe(404);
    expect((await readRange(null, plan.id)).status).toBe(404);
    expect(doorCalls()).toHaveLength(0);
  });

  it('never reads through a share code sent with the request', async () => {
    const { ada, plan } = await setup();
    const code = await shareLink(ada.auth, plan.id, { level: 'view' });
    const cy = await person('user_cy');
    const res = await readRange(cy.auth, plan.id, undefined, { 'X-Share-Code': code });
    expect(res.status).toBe(404);
    expect(doorCalls()).toHaveLength(0);
  });

  it('never reads for an app acting for a person', async () => {
    const { plan } = await setup();
    const res = await readRange('lp-key', plan.id, undefined, {
      'X-Index-App': 'liveplanner',
      'X-Index-Person': 'user_ada',
    });
    expect(res.status).toBe(404);
  });

  it('answers as missing for an item of an app with no sheets', async () => {
    const { ada, doc } = await setup();
    expect((await readRange(ada.auth, doc.id)).status).toBe(404);
  });

  it("keeps a tab-scoped link's reader on its own tab", async () => {
    const { ada, plan } = await setup();
    const code = await shareLink(ada.auth, plan.id, { level: 'view', tabId: 'tab-2' });
    const bo = await person('user_bo');
    await call(`/share/${code}`, { auth: bo.auth, headers: { 'X-Share-Code': code } });
    expect((await readRange(bo.auth, plan.id)).status).toBe(404);
    const list = await body<{ sheets: { id: string }[] }>(
      await call(`/items/${plan.id}/sheets`, { auth: bo.auth }),
    );
    expect(list.sheets.map((s) => s.id)).toEqual(['s2']);
  });

  it('refuses a malformed ask before reading anything', async () => {
    const { ada, plan } = await setup();
    const res = await readRange(ada.auth, plan.id, { sheetId: 's1' });
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error: 'invalid_range' });
    expect(doorCalls()).toHaveLength(0);
  });

  it.each([
    [404, 404, 'not_found'],
    [409, 409, 'range_gone'],
    [400, 400, 'invalid_range'],
    [500, 503, 'source_unavailable'],
  ])("answers the door's %i as %i", async (doorStatus, status, error) => {
    const { ada, plan } = await setup();
    sheetApp(() => Response.json({ error: 'x' }, { status: doorStatus }));
    const res = await readRange(ada.auth, plan.id);
    expect(res.status).toBe(status);
    expect(await body(res)).toEqual({ error });
  });

  it('only answers POST', async () => {
    const { ada, plan } = await setup();
    expect((await call(`/items/${plan.id}/sheet-range`, { auth: ada.auth })).status).toBe(404);
    expect(
      (await call(`/items/${plan.id}/sheets`, { method: 'POST', auth: ada.auth, body: {} })).status,
    ).toBe(404);
  });
});

describe('watching', () => {
  it("passes the document on as a watcher only with the document's own grant", async () => {
    const { ada, plan, doc } = await setup();
    const grant = await grantFor(ada.auth, doc.id);
    h.appCalls = [];
    await readRange(
      ada.auth,
      plan.id,
      { sheetId: 's1', range: RANGE, watch: { itemId: doc.id } },
      { 'X-Index-Grant': grant },
    );
    expect(doorCalls()[0]!.body).toEqual({ sheetId: 's1', range: RANGE, watcher: doc.id });
  });

  it('reads without a watch for a missing, mismatched or wrong-app grant', async () => {
    const { ada, plan, doc } = await setup();
    const planGrant = await grantFor(ada.auth, plan.id);
    const other = await makeItem(ada.auth, { app: 'livedocuments' });
    const otherGrant = await grantFor(ada.auth, other.id);
    h.appCalls = [];
    const watch = { sheetId: 's1', a1: 'A1', watch: { itemId: doc.id } };
    await readRange(ada.auth, plan.id, watch);
    await readRange(ada.auth, plan.id, watch, { 'X-Index-Grant': otherGrant });
    await readRange(
      ada.auth,
      plan.id,
      { ...watch, watch: { itemId: plan.id } },
      { 'X-Index-Grant': planGrant },
    );
    await readRange(ada.auth, plan.id, { ...watch, watch: 'nope' });
    expect(doorCalls().map((c) => (c.body as { watcher?: string }).watcher)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("takes a link visitor's grant on the document, never a public link's", async () => {
    const { ada, plan, doc } = await setup();
    const code = await shareLink(ada.auth, doc.id, { level: 'view' });
    const bo = await person('user_bo');
    await call(`/share/${code}`, { auth: bo.auth, headers: { 'X-Share-Code': code } });
    const planCode = await shareLink(ada.auth, plan.id, { level: 'view' });
    await call(`/share/${planCode}`, { auth: bo.auth, headers: { 'X-Share-Code': planCode } });
    const grant = await grantFor(bo.auth, doc.id, code);
    h.appCalls = [];
    const ask = { sheetId: 's1', a1: 'A1', watch: { itemId: doc.id } };
    await readRange(bo.auth, plan.id, ask, { 'X-Index-Grant': grant });
    expect((doorCalls()[0]!.body as { watcher?: string }).watcher).toBe(doc.id);
    h.db.sql.prepare('UPDATE share_links SET public = 1 WHERE code = ?').run(code);
    await readRange(bo.auth, plan.id, ask, { 'X-Index-Grant': grant });
    expect((doorCalls()[1]!.body as { watcher?: string }).watcher).toBeUndefined();
  });
});

describe('listing sheets', () => {
  it("lists the plan's Sheets with its name", async () => {
    const { ada, plan } = await setup();
    const res = await call(`/items/${plan.id}/sheets`, { auth: ada.auth });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ itemId: plan.id, itemName: 'Q4 Metrics', sheets: SHEETS });
    expect(doorCalls()[0]!.url).toBe(
      `https://liveplanner.app/api/internal/items/${plan.id}/sheets`,
    );
  });

  it('answers as missing for a stranger and passes on a failed door', async () => {
    const { ada, plan } = await setup();
    const cy = await person('user_cy');
    expect((await call(`/items/${plan.id}/sheets`, { auth: cy.auth })).status).toBe(404);
    sheetApp(() => new Response('down', { status: 502 }));
    const warn = h.appCalls.length;
    const res = await call(`/items/${plan.id}/sheets`, { auth: ada.auth });
    expect(res.status).toBe(503);
    expect(h.appCalls.length).toBe(warn + 1);
  });
});

describe('the change signal', () => {
  const KEYS: Record<string, string> = {
    liveplanner: 'lp-key',
    livediagram: 'ld-key',
    livedocuments: 'lvd-key',
  };
  const signal = (planId: string, input: unknown, app = 'liveplanner') =>
    call(`/app/items/${planId}/sheet-changed`, {
      method: 'POST',
      auth: KEYS[app],
      headers: { 'X-Index-App': app },
      body: input,
    });

  it("tells each watcher's app, with ids only, and answers the ones gone", async () => {
    const { ada, plan, doc } = await setup();
    const diagram = await makeItem(ada.auth, { app: 'livediagram' });
    h.appCalls = [];
    const res = await signal(plan.id, {
      sheetIds: ['s1', 's1'],
      watchers: [doc.id, diagram.id, 'gone_doc', doc.id],
    });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ gone: [diagram.id, 'gone_doc'] });
    expect(h.appCalls).toEqual([
      expect.objectContaining({
        method: 'POST',
        url: `https://livedocuments.app/api/internal/items/${doc.id}/source-changed`,
        body: { app: 'liveplanner', itemId: plan.id, sheetIds: ['s1'] },
      }),
    ]);
    expect(h.appCalls[0]!.headers.get('Authorization')).toBe('Bearer lvd-key');
  });

  it('logs a watcher it could not reach and carries on', async () => {
    const { plan, doc } = await setup();
    h.appAnswer = () => new Response(null, { status: 500 });
    const res = await signal(plan.id, { sheetIds: ['s1'], watchers: [doc.id] });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ gone: [] });
  });

  it("refuses another app's plan, an app without sheets, and a malformed body", async () => {
    const { plan, doc } = await setup();
    expect(
      (await signal(plan.id, { sheetIds: ['s1'], watchers: [doc.id] }, 'livediagram')).status,
    ).toBe(403);
    expect(
      (await signal(doc.id, { sheetIds: ['s1'], watchers: [plan.id] }, 'livedocuments')).status,
    ).toBe(403);
    expect((await signal(plan.id, { sheetIds: [], watchers: [doc.id] })).status).toBe(400);
    expect((await signal(plan.id, { sheetIds: ['s1'], watchers: [] })).status).toBe(400);
    expect((await signal('nope_plan', { sheetIds: ['s1'], watchers: [doc.id] })).status).toBe(404);
    expect(
      (
        await call(`/app/items/${plan.id}/sheet-changed`, {
          method: 'PUT',
          auth: 'lp-key',
          headers: { 'X-Index-App': 'liveplanner' },
          body: {},
        })
      ).status,
    ).toBe(404);
  });
});
