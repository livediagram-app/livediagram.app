// Mentions (webhooks.md "What it sends"): a comment that newly @-mentions someone goes only to webhooks the mentioned
// person, or their team, can read the item through, never to anyone else's, and costs the push no query per mention
// or per webhook.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../env';
import { body, call, h, makeItem, person, settle, useHarness } from '../test-support';
import { MENTIONS_PER_PUSH_MAX } from './mentions';
import {
  addWebhook,
  answerWorld,
  deliveries,
  newWorld,
  WEBHOOK_KEY,
  type World,
} from './test-webhooks';

useHarness({ WEBHOOK_KEY });

let world: World;
let accountsAsks: string[];
beforeEach(() => {
  world = newWorld();
  accountsAsks = [];
  answerWorld(world);
  const answer = h.appAnswer!;
  h.appAnswer = (c) => {
    if (c.url.endsWith('/api/account/index/teams'))
      accountsAsks.push((c.body as { userId: string }).userId);
    return answer(c);
  };
});

type Thread = { elementId?: string; commentCount: number; mentionedIds: string[]; by?: string };

function threadOf({ elementId = 'e1', commentCount, mentionedIds, by = 'user_ada' }: Thread) {
  const now = Date.now();
  return {
    elementId,
    elementLabel: 'Launch box',
    resolved: false,
    commentCount,
    participantIds: [by],
    mentionedIds,
    latestText: 'Can you look at this?',
    latestAuthorName: 'Ada',
    latestAuthorId: by,
    firstAt: now,
    latestAt: now,
  };
}

const push = (itemId: string, tabId: string, threads: Thread[], env?: Env) =>
  call(`/app/items/${itemId}/collab/${tabId}`, {
    method: 'PUT',
    auth: 'lp-key',
    headers: { 'X-Index-App': 'liveplanner' },
    body: { threads: threads.map(threadOf), actions: [] },
    env,
  });

// Which webhook each mention went to, by the webhook's name.
async function heard(): Promise<string[]> {
  const names = new Map(
    (h.db.sql.prepare('SELECT id, name FROM webhooks').all() as { id: string; name: string }[]).map(
      (w) => [w.id, w.name],
    ),
  );
  return deliveries()
    .filter((d) => d.type === 'mention')
    .map(
      (d) => `${names.get(d.webhook_id as string)} ${JSON.parse(d.detail as string).mentionedId}`,
    )
    .sort();
}

async function share(auth: string, itemId: string, input: Record<string, unknown> = {}) {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: input });
  expect(res.status).toBe(201);
  await settle();
  return (await body<{ link: { code: string } }>(res)).link;
}

describe('who a mention reaches', () => {
  it("reaches the mentioned person's own webhook through their link, never the owner's or a stranger's", async () => {
    const ada = await person('user_ada');
    const bo = await person('user_bo');
    const cy = await person('user_cy');
    await addWebhook(ada.auth, { name: 'Ada', events: ['mention', 'commented'] });
    await addWebhook(bo.auth, { name: 'Bo', events: ['mention'] });
    await addWebhook(cy.auth, { name: 'Cy', events: ['mention'] });
    const item = await makeItem(ada.auth, { title: 'Launch' });
    const link = await share(ada.auth, item.id, { level: 'view' });
    await call(`/share/${link.code}`, { auth: bo.auth });

    // Ada mentions Bo (who holds a link) and Cy (who can't read it).
    expect(
      (await push(item.id, 't1', [{ commentCount: 1, mentionedIds: ['user_bo', 'user_cy'] }]))
        .status,
    ).toBe(204);
    expect(await heard()).toEqual(['Bo user_bo']);
    const row = deliveries().find((d) => d.type === 'mention')!;
    expect(row).toMatchObject({
      app: 'liveplanner',
      item_id: item.id,
      title: 'Launch',
      actor_id: 'user_ada',
      actor_name: 'Ada',
    });
    expect(JSON.parse(row.detail as string)).toEqual({
      text: 'Can you look at this?',
      on: 'Launch box',
      mentionedId: 'user_bo',
    });
    // Ada's own webhook hears her comment, never the mention of someone else.
    expect(deliveries().filter((d) => d.type === 'commented')).toHaveLength(1);

    // Sent again: nothing new. A later comment naming Bo again in the same thread: not news.
    await push(item.id, 't1', [{ commentCount: 1, mentionedIds: ['user_bo', 'user_cy'] }]);
    await push(item.id, 't1', [{ commentCount: 2, mentionedIds: ['user_bo', 'user_cy'] }]);
    expect(await heard()).toEqual(['Bo user_bo']);

    // Bo mentions Ada, the owner: her webhook hears it. A self-mention is never news.
    await push(item.id, 't1', [
      { commentCount: 3, mentionedIds: ['user_bo', 'user_cy', 'user_ada'], by: 'user_bo' },
      { elementId: 'e2', commentCount: 1, mentionedIds: ['user_bo'], by: 'user_bo' },
    ]);
    expect(await heard()).toEqual(['Ada user_ada', 'Bo user_bo']);
    // A personal item asks accounts nothing.
    expect(accountsAsks).toEqual([]);
  });

  it("never reaches a link holder whose link is to another tab, or once it's revoked", async () => {
    const ada = await person('user_ada');
    const dee = await person('user_dee');
    await addWebhook(dee.auth, { name: 'Dee', events: ['mention'] });
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'edit', tabId: 't2' });
    await call(`/share/${link.code}`, { auth: dee.auth });

    await push(item.id, 't1', [{ commentCount: 1, mentionedIds: ['user_dee'] }]);
    expect(await heard()).toEqual([]);
    await push(item.id, 't2', [{ commentCount: 1, mentionedIds: ['user_dee'] }]);
    expect(await heard()).toEqual(['Dee user_dee']);

    await call(`/share/${link.code}`, { method: 'DELETE', auth: ada.auth });
    await push(item.id, 't2', [
      { commentCount: 1, mentionedIds: ['user_dee'] },
      { elementId: 'e9', commentCount: 1, mentionedIds: ['user_dee'] },
    ]);
    expect(await heard()).toEqual(['Dee user_dee']);
  });

  it("reaches a team member's own webhook and the item's team's, never another team's or a non-member's", async () => {
    const ed = await person('user_ed', { teams: [{ id: 'teamA', role: 'admin' }] });
    const fi = await person('user_fi', { teams: [{ id: 'teamA', role: 'member' }] });
    const gus = await person('user_gus', { teams: [{ id: 'teamB', role: 'admin' }] });
    world.roles.user_ed = [{ id: 'teamA', role: 'admin' }];
    world.roles.user_fi = [{ id: 'teamA', role: 'member' }];
    world.roles.user_gus = [{ id: 'teamB', role: 'admin' }];
    await addWebhook(ed.auth, { name: 'Team A', teamId: 'teamA', events: ['mention'] });
    await addWebhook(fi.auth, { name: 'Fi', events: ['mention'] });
    await addWebhook(gus.auth, { name: 'Gus', events: ['mention'] });
    await addWebhook(gus.auth, { name: 'Team B', teamId: 'teamB', events: ['mention'] });
    const item = await makeItem(ed.auth, { title: 'Team plan', teamId: 'teamA' });
    accountsAsks = [];

    await push(item.id, 't1', [
      { commentCount: 1, mentionedIds: ['user_fi', 'user_gus', 'member_123'], by: 'user_ed' },
    ]);
    expect(await heard()).toEqual(['Fi user_fi', 'Team A user_fi']);
    // One ask a person, only for the accounts a team decides.
    expect(accountsAsks.sort()).toEqual(['user_fi', 'user_gus']);
  });

  it("sends nothing a team decides while accounts can't say who is in it", async () => {
    const ed = await person('user_ed', { teams: [{ id: 'teamA', role: 'admin' }] });
    const fi = await person('user_fi', { teams: [{ id: 'teamA', role: 'member' }] });
    world.roles.user_ed = [{ id: 'teamA', role: 'admin' }];
    await addWebhook(ed.auth, { name: 'Team A', teamId: 'teamA', events: ['mention'] });
    await addWebhook(fi.auth, { name: 'Fi', events: ['mention'] });
    const item = await makeItem(ed.auth, { teamId: 'teamA' });
    world.accountsDown = true;
    await push(item.id, 't1', [{ commentCount: 1, mentionedIds: ['user_fi'], by: 'user_ed' }]);
    expect(await heard()).toEqual([]);
  });

  it('hands on at most MENTIONS_PER_PUSH_MAX mentions a push', async () => {
    const ada = await person('user_ada');
    await addWebhook(ada.auth, { name: 'Ada', events: ['mention'] });
    const item = await makeItem(ada.auth);
    // Ada mentioned on many threads of one tab by Bo, in one push.
    const threads = Array.from({ length: MENTIONS_PER_PUSH_MAX + 2 }, (_, i) => ({
      elementId: `e${i}`,
      commentCount: 1,
      mentionedIds: ['user_ada'],
      by: 'user_bo',
    }));
    await push(item.id, 't1', threads);
    expect(await heard()).toHaveLength(MENTIONS_PER_PUSH_MAX);
  });
});

// The card's performance note: the outbox write stays one batched write per save, with no query per mention or per
// webhook. Counted on the D1 surface: a push's round trips (batches and single queries) and statements.
describe('cost', () => {
  function counting() {
    const counts = { batches: 0, statements: 0, singles: 0 };
    const db = h.db.env.INDEX_DB as unknown as {
      prepare: (q: string) => Record<string, (...a: unknown[]) => unknown>;
      batch: (s: unknown[]) => Promise<unknown>;
    };
    const wrap = (s: Record<string, (...a: unknown[]) => unknown>): Record<string, unknown> => ({
      ...s,
      bind: (...a: unknown[]) => wrap(s.bind!(...a) as typeof s),
      first: (...a: unknown[]) => (counts.singles++, s.first!(...a)),
      all: () => (counts.singles++, s.all!()),
      run: () => (counts.singles++, s.run!()),
    });
    const env = {
      ...h.db.env,
      INDEX_DB: {
        prepare: (q: string) => wrap(db.prepare(q)),
        batch: (s: unknown[]) => {
          counts.batches++;
          counts.statements += s.length;
          return db.batch(s);
        },
      } as unknown as D1Database,
    };
    return { env, counts };
  }

  it('costs a push two round trips however many people and webhooks a mention reaches', async () => {
    const ada = await person('user_ada');
    const item = await makeItem(ada.auth);
    const people = Array.from({ length: 8 }, (_, i) => `user_p${i}`);
    for (const id of people) {
      const p = await person(id);
      // Several webhooks each: still one statement.
      await addWebhook(p.auth, { name: `${id} a`, events: ['mention'] });
      await addWebhook(p.auth, { name: `${id} b`, events: ['mention'] });
      await call(`/share/${(await share(ada.auth, item.id)).code}`, { auth: p.auth });
    }

    const quiet = counting();
    await push(item.id, 'tq', [{ commentCount: 1, mentionedIds: [] }], quiet.env);
    const mentioning = counting();
    await push(item.id, 'tm', [{ commentCount: 1, mentionedIds: people }], mentioning.env);
    expect(await heard()).toHaveLength(people.length * 2);
    console.info('[measure] mention push', { quiet: quiet.counts, mentioning: mentioning.counts });
    // The same round trips as a push that mentions no one; two probe reads and one write more, in those batches.
    expect(mentioning.counts.batches).toBe(quiet.counts.batches);
    expect(mentioning.counts.singles).toBe(quiet.counts.singles);
    expect(mentioning.counts.statements - quiet.counts.statements).toBe(3);
    expect(accountsAsks).toEqual([]);
  });
});
