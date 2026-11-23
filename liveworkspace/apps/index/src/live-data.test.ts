// Live data over HTTP (liveworkspace/docs/specs/004-index/live-data.md): a board's counts or a metric's rows read on the
// reader's own access only, the door it calls on the plan app's key, the watch only with the reader item's own grant,
// and a tab-scoped link kept to its own tab's board.
import type { PlanDataListing, PlanDataRead } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness, type AppCall } from './test-support';

useHarness({
  INDEX_KEY_LIVEDOCUMENTS: 'lvd-key',
  APP_ORIGIN_LIVEDOCUMENTS: 'https://livedocuments.app',
});

const COUNTS = {
  sourceName: 'Roadmap',
  tabId: 'tab-1',
  label: 'Cards per column',
  table: { categories: ['To Do', 'Done'], series: [{ name: 'Cards', values: [3, 5] }] },
};
const LISTING = {
  boards: [
    { id: 'tab-1', name: 'Roadmap', tabId: 'tab-1' },
    { id: 'tab-2', name: 'Bugs', tabId: 'tab-2' },
  ],
  metrics: [{ id: 'count', label: 'Cards' }],
  filters: { priorities: [], labels: ['bug'], people: [], types: [] },
};
const BOARD = { kind: 'board', boardId: 'tab-1', by: 'column' };

function planApp(answer: (c: AppCall) => Response | undefined = () => undefined) {
  h.appAnswer = (c) => {
    const given = answer(c);
    if (given) return given;
    if (c.url.endsWith('/plan-data')) return Response.json(c.method === 'POST' ? COUNTS : LISTING);
    return new Response(null, { status: 202 });
  };
}

const readData = (
  auth: string | null,
  planId: string,
  input: Record<string, unknown> = BOARD,
  headers: Record<string, string> = {},
) => call(`/items/${planId}/plan-data`, { method: 'POST', auth, body: input, headers });

async function setup() {
  const ada = await person('user_ada');
  const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch Plan' });
  const doc = await makeItem(ada.auth, { app: 'livedocuments', title: 'Weekly' });
  await settle();
  h.appCalls = [];
  planApp();
  return { ada, plan, doc };
}

const doorCalls = () => h.appCalls.filter((c) => c.url.endsWith('/plan-data'));

async function linkVisitor(ownerAuth: string, itemId: string, input: Record<string, unknown>) {
  const res = await call(`/items/${itemId}/share`, {
    method: 'POST',
    auth: ownerAuth,
    body: input,
  });
  const code = (await body<{ link: { code: string } }>(res)).link.code;
  const bo = await person('user_bo');
  await call(`/share/${code}`, { auth: bo.auth, headers: { 'X-Share-Code': code } });
  return { bo, code };
}

describe('reading live data', () => {
  it("reads a board's counts through the plan app's door on its own key", async () => {
    const { ada, plan } = await setup();
    const res = await readData(ada.auth, plan.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(await body<PlanDataRead>(res)).toEqual({
      ...COUNTS,
      itemId: plan.id,
      itemName: 'Launch Plan',
      kind: 'board',
      readAt: expect.any(Number),
    });
    const [door] = doorCalls();
    expect(door!.url).toBe(`https://liveplanner.app/api/internal/items/${plan.id}/plan-data`);
    expect(door!.headers.get('Authorization')).toBe('Bearer lp-key');
    expect(door!.body).toEqual(BOARD);
  });

  it("lists the plan's boards and metrics, with its name", async () => {
    const { ada, plan } = await setup();
    const res = await call(`/items/${plan.id}/plan-data`, { auth: ada.auth });
    expect(await body<PlanDataListing>(res)).toEqual({
      ...LISTING,
      itemId: plan.id,
      itemName: 'Launch Plan',
    });
  });

  it('answers as missing to anyone who cannot open the plan, a share code or an app', async () => {
    const { ada, plan, doc } = await setup();
    const cy = await person('user_cy');
    expect((await readData(cy.auth, plan.id)).status).toBe(404);
    expect((await readData(null, plan.id)).status).toBe(404);
    expect((await call(`/items/${plan.id}/plan-data`, { auth: cy.auth })).status).toBe(404);
    const res = await call(`/items/${plan.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'view' },
    });
    const code = (await body<{ link: { code: string } }>(res)).link.code;
    expect((await readData(cy.auth, plan.id, BOARD, { 'X-Share-Code': code })).status).toBe(404);
    expect(
      (
        await readData('lp-key', plan.id, BOARD, {
          'X-Index-App': 'liveplanner',
          'X-Index-Person': 'user_ada',
        })
      ).status,
    ).toBe(404);
    expect((await readData(ada.auth, doc.id)).status).toBe(404);
    expect(doorCalls()).toHaveLength(0);
  });

  it("keeps a tab-scoped link's reader on its own tab's board, and off the plan-wide metrics", async () => {
    const { ada, plan } = await setup();
    const { bo } = await linkVisitor(ada.auth, plan.id, { level: 'view', tabId: 'tab-2' });
    expect((await readData(bo.auth, plan.id)).status).toBe(404);
    expect((await readData(bo.auth, plan.id, { kind: 'metric', metric: 'count' })).status).toBe(
      404,
    );
    const list = await body<PlanDataListing>(
      await call(`/items/${plan.id}/plan-data`, { auth: bo.auth }),
    );
    expect(list.boards.map((b) => b.id)).toEqual(['tab-2']);
  });

  it('refuses a malformed ask before reading anything', async () => {
    const { ada, plan } = await setup();
    const res = await readData(ada.auth, plan.id, { kind: 'board', boardId: 'tab-1', by: 'x' });
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error: 'invalid_source' });
    expect(doorCalls()).toHaveLength(0);
  });

  it.each([
    [404, 404, 'not_found'],
    [400, 400, 'invalid_source'],
    [500, 503, 'source_unavailable'],
  ])("answers the door's %i as %i", async (doorStatus, status, error) => {
    const { ada, plan } = await setup();
    planApp(() => Response.json({ error: 'x' }, { status: doorStatus }));
    const res = await readData(ada.auth, plan.id);
    expect(res.status).toBe(status);
    expect(await body(res)).toEqual({ error });
    const list = await call(`/items/${plan.id}/plan-data`, { auth: ada.auth });
    expect(list.status).toBe(status);
  });

  it('answers only GET and POST', async () => {
    const { ada, plan } = await setup();
    expect(
      (await call(`/items/${plan.id}/plan-data`, { method: 'PUT', auth: ada.auth, body: {} }))
        .status,
    ).toBe(404);
  });

  it("passes the document on as a watcher only with the document's own grant", async () => {
    const { ada, plan, doc } = await setup();
    const res = await call(`/items/${doc.id}/grant`, { method: 'POST', auth: ada.auth });
    const { grant } = await body<{ grant: string }>(res);
    h.appCalls = [];
    await readData(
      ada.auth,
      plan.id,
      { kind: 'metric', metric: 'count', watch: { itemId: doc.id } },
      { 'X-Index-Grant': grant },
    );
    await readData(ada.auth, plan.id, { ...BOARD, watch: { itemId: doc.id } });
    expect(doorCalls().map((c) => c.body)).toEqual([
      { kind: 'metric', metric: 'count', watcher: doc.id },
      BOARD,
    ]);
  });
});
