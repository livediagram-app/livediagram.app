import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormLinkResponse, PublicFormResponse } from '@liveplanner/api-schema';
import { MONTHLY_LIMIT_MESSAGE, type FormDefinition } from '@liveplanner/forms';
import { presetSetup } from '@liveplanner/items';
import { monthKey } from '@liveworkspace/subscription';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { formMonthFull, getFormLink, listItems } from '../db';
import { PlanTier } from '../plan-room/tier/plan-tier';
import { fakeSubscription, proEnv, type FakeSubscription } from '../plan-room/tier/test-tier';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleProjects } from '../routes/projects';
import { handleForms } from '../routes/forms';
import { subscriptionOf } from '../subscription';
import { stubFormIndex } from './test-form-index';

// The owner's month of responses (docs/specs/030-forms/forms.md "Abuse and limits → Tiers"): with Pro on, each
// response spends one of the plan's OWNER's tier's responses a UTC month, over every form they own, after which the
// form reads closed with one neutral line; with Pro off, nothing is counted. Through the real routes on a plan's SQLite, the subscription service a stand-in.

const FORM: FormDefinition = {
  v: 1,
  heading: 'Bug Report',
  closedMessage: 'We are done here.',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        { id: 'q-sum', type: 'short', prompt: 'Summary', required: true, goesTo: { to: 'title' } },
      ],
    },
  ],
  destination: { tabId: 'board', typeId: 'bug', status: 'new' },
};

let sql: SqliteD1;
let fake: FakeSubscription;
// The plan's head as its tier reads it: a test moves the plan to a team by changing it.
let head: { ownerId: string; teamId: string | null; name: string };
const env = () => sql.env;

async function call<T>(handler: typeof handleForms, method: string, url: string, body?: unknown) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, url, {
    env: sql.env,
    owner: url.startsWith('/api/forms/') ? null : 'user_owner',
    ...(body === undefined ? {} : { body }),
    headers: { 'CF-Connecting-IP': '203.0.113.9' },
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handler(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}
const tab = <T = FormLinkResponse>(method: string, path: string, body?: unknown) =>
  call<T>(handleProjects, method, `/api/projects/d1/tabs/ftab/${path}`, body);
const pub = <T = unknown>(method: string, path: string, body?: unknown) =>
  call<T>(handleForms, method, `/api/forms/${path}`, body);
const respond = (code: string, extra: Record<string, unknown> = {}) =>
  pub(`POST`, `${code}/responses`, { answers: { 'q-sum': 'It broke' }, ...extra });
const month = () => monthKey(Date.now());
// The owner has spent `used` of this month's responses, over every form they own.
const tookThisMonth = (used: number, owner = 'p:user_owner') =>
  fake.spent.set(`${owner}:formResponses`, used);
const spentThisMonth = (owner = 'p:user_owner') => fake.spent.get(`${owner}:formResponses`) ?? 0;
const markedFull = async (code: string, limit: number) =>
  formMonthFull((await getFormLink(env(), code))!, { key: month(), limit });

// The plan, its board and its Form tab; `tiers` turns Pro on with those owners' tiers.
function world(tiers?: Parameters<typeof fakeSubscription>[0]) {
  const index = stubFormIndex();
  sql = sqliteD1(index.env);
  fake = fakeSubscription(tiers ?? {});
  head = { ownerId: 'user_owner', teamId: null, name: 'Ops' };
  if (tiers) proEnv(sql.env, fake);
  else Object.assign(sql.env, { SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher });
  Reflect.set(
    sql.env,
    'TIER',
    new PlanTier({ client: () => subscriptionOf(sql.env), head: () => head, defer: () => {} }),
  );
  Reflect.set(sql.env, 'PLAN_ROOM', {
    idFromName: (n: string) => n,
    get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
  });
  const catalogue = {
    version: 1,
    types: [
      {
        id: 'bug',
        label: 'Bug',
        newTitle: 'New bug',
        glyph: 'bug',
        color: '#0284c7',
        fields: ['title', 'status', 'description'],
        custom: [],
      },
    ],
  };
  sql.sql
    .prepare(
      `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'user_owner', 'Ops', 1, 1, 1)`,
    )
    .run();
  sql.sql.prepare(`UPDATE plan SET item_types = ? WHERE id = 'd1'`).run(JSON.stringify(catalogue));
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('bug-triage'),
  };
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('board', 'Bugs', ?, 1)`)
    .run(JSON.stringify({ kind: 'board', elements: [board] }));
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('ftab', 'Bug Report', ?, 1)`)
    .run(JSON.stringify({ kind: 'form', elements: [], form: FORM }));
  sql.sql.exec(`
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 'board', 0, 1);
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 'ftab', 1, 1);
  `);
}
async function publish(): Promise<string> {
  const res = await tab('POST', 'form-link');
  expect(res.status).toBe(200);
  return res.body.link!.code;
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('with Pro off', () => {
  it('counts no month, takes every response, and asks the subscription service nothing', async () => {
    world();
    const code = await publish();
    expect((await respond(code)).status).toBe(201);
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('open');
    const link = (await tab('GET', 'form-link')).body;
    expect(link.month).toBeUndefined();
    expect(link.owner).toBeUndefined();
    expect(fake.calls).toEqual([]);
  });
});

describe('the owner’s month', () => {
  it('spends one response a response, and closes past Free’s 500 with one neutral line', async () => {
    world({});
    const code = await publish();
    tookThisMonth(499);
    expect((await respond(code)).status).toBe(201);
    expect(spentThisMonth()).toBe(500);
    expect(fake.to('spend')).toEqual([
      { owner: 'p:user_owner', meter: 'formResponses', amount: 1 },
    ]);
    const over = await respond(code);
    expect(over).toEqual({ status: 409, body: { error: 'form_closed' } });
    const page = (await pub<PublicFormResponse>('GET', code)).body;
    expect(page).toMatchObject({ state: 'closed', message: MONTHLY_LIMIT_MESSAGE });
    expect(MONTHLY_LIMIT_MESSAGE).toBe(
      "This form isn't accepting responses right now. Please try again later.",
    );
    // The refused response made nothing and kept no number.
    expect(await listItems(env(), 'd1')).toHaveLength(1);
    expect((await getFormLink(env(), code))!.responses).toBe(1);
    // Closed now, the next response asks the service nothing more than the limits.
    const spends = fake.to('spend').length;
    expect((await respond(code)).status).toBe(409);
    expect(fake.to('spend')).toHaveLength(spends);
    // The Editor's read says it is full, and whose tier; what is used is the owner's own to read.
    expect((await tab('GET', 'form-link')).body).toMatchObject({
      link: { open: true },
      month: { limit: 500, full: true },
      owner: 'p:user_owner',
    });
  });

  it('is counted over every form the owner has: another form of theirs closes it too', async () => {
    world({});
    const code = await publish();
    tookThisMonth(500);
    expect((await respond(code)).status).toBe(409);
    expect(await markedFull(code, 500)).toBe(true);
  });

  it('allows more on Pro', async () => {
    world({ 'p:user_owner': 'pro' });
    const code = await publish();
    tookThisMonth(500);
    expect((await respond(code)).status).toBe(201);
    expect((await tab('GET', 'form-link')).body.month).toEqual({ limit: 10_000, full: false });
  });

  it('opens again by itself next month, and as soon as the owner’s tier allows more', async () => {
    world({});
    const code = await publish();
    tookThisMonth(500);
    expect((await respond(code)).status).toBe(409);
    // Found full last month is not this month.
    sql.sql.prepare("UPDATE form_links SET month = '2000-01'").run();
    tookThisMonth(0);
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('open');
    expect((await respond(code)).status).toBe(201);
    // Full again, then the owner subscribes: open within the minute the limits are kept.
    tookThisMonth(500);
    expect((await respond(code)).status).toBe(409);
    vi.useFakeTimers({ toFake: ['Date'] });
    fake.set('p:user_owner', 'pro');
    vi.setSystemTime(Date.now() + 61_000);
    const later = await respond(code);
    vi.useRealTimers();
    expect(later.status).toBe(201);
  });

  it('opens on the response straight after an upgrade, asking for the limits once more before it refuses', async () => {
    world({});
    const code = await publish();
    tookThisMonth(500);
    expect((await respond(code)).status).toBe(409);
    // The owner pays; the room and the client both still remember Free.
    fake.tiers.set('p:user_owner', 'pro');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 6_000);
    const later = await respond(code);
    vi.useRealTimers();
    expect(later.status).toBe(201);
  });

  it('asks the respondent to try again when the service refuses to check, giving the number back', async () => {
    world({});
    const code = await publish();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const answer = fake.fetcher.fetch;
    fake.fetcher.fetch = async (input, init) =>
      String(input).endsWith('/spend') ? new Response(null, { status: 401 }) : answer(input, init);
    expect(await respond(code)).toEqual({ status: 429, body: { error: 'form_busy' } });
    expect((await getFormLink(env(), code))!.responses).toBe(0);
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('open');
  });

  it('spends nothing for a plan that is nobody’s yet', async () => {
    world({});
    const code = await publish();
    head = { ownerId: '', teamId: null, name: 'Ops' };
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('open');
    expect((await respond(code)).status).toBe(201);
    expect(fake.calls.filter((c) => c.path !== 'entitlement')).toEqual([]);
  });

  it('spends nothing for a guest’s plan, asking the service nothing', async () => {
    world({});
    const code = await publish();
    const before = fake.calls.length;
    head = { ownerId: 'guest_abc', teamId: null, name: 'Ops' };
    expect((await respond(code)).status).toBe(201);
    expect(fake.calls).toHaveLength(before);
  });

  it('is the team’s for a team’s plan, whatever the owning person holds', async () => {
    // A Pro person's form in a three-member Pro for Teams library: the team's 5,000 a member, pooled.
    world({ 'p:user_owner': 'pro', 't:team_1': 'team' });
    head = { ownerId: 'user_owner', teamId: 'team_1', name: 'Ops' };
    const code = await publish();
    tookThisMonth(15_000, 't:team_1');
    expect((await respond(code)).status).toBe(409);
    expect((await tab('GET', 'form-link')).body).toMatchObject({
      month: { limit: 15_000 },
      owner: 't:team_1',
    });
  });

  it('ignores a tier a response claims', async () => {
    world({});
    const code = await publish();
    tookThisMonth(500);
    const claimed = await respond(code, { tier: 'pro', limits: { formResponsesPerMonth: 9999 } });
    expect(claimed.status).toBe(409);
  });

  it('never spends a Preview, and takes one while the month is full', async () => {
    world({});
    const code = await publish();
    tookThisMonth(500);
    expect((await respond(code)).status).toBe(409);
    const preview = await tab('POST', 'form-preview', { answers: { 'q-sum': 'Try' } });
    expect(preview.status).toBe(201);
    expect(spentThisMonth()).toBe(500);
  });

  it('keeps the form’s own Response Limit and its message in force, spending nothing past it', async () => {
    world({ 'p:user_owner': 'pro' });
    sql.sql
      .prepare(`UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 'ftab'`)
      .run(JSON.stringify({ kind: 'form', elements: [], form: { ...FORM, limit: 1 } }));
    const code = await publish();
    expect((await respond(code)).status).toBe(201);
    expect((await respond(code)).status).toBe(409);
    expect(spentThisMonth()).toBe(1);
    expect((await pub<PublicFormResponse>('GET', code)).body).toMatchObject({
      state: 'closed',
      message: 'We are done here.',
    });
  });

  it('is one spend a response, and tells the service no item count', async () => {
    world({});
    const code = await publish();
    for (let i = 0; i < 5; i += 1) expect((await respond(code)).status).toBe(201);
    expect(fake.to('spend')).toHaveLength(5);
    expect(fake.to('item-count')).toEqual([]);
  });
});
