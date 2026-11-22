// Steps in other apps (automations.md "Steps in other apps", blueprint cross-app.md "The index"): a plan's rule acts on
// a livediagram document as its author. The index checks the chain and the author's day, reaches the target only
// with the author's own access, signs their grant and asks the target's door, which answers; a target the author
// cannot reach is `no_access`, whoever's it is. A Notify's notices are the index's own and show in the Inbox.
import {
  CROSS_APP_AUTHOR_DAY_MAX,
  type AutomationStepAnswer,
  type AutomationStepPush,
} from '@liveworkspace/index-client';
import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { countStep } from './automation-steps';
import { noticePeople } from './automation-step-notices';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const DAY_MS = 86_400_000;

async function world() {
  const ada = await person('user_ada');
  const ben = await person('user_ben');
  const plan = await makeItem(ada.auth, { title: 'Launch' });
  const doc = await makeItem(ada.auth, { app: 'livediagram', title: 'Board' });
  const bens = await makeItem(ben.auth, { app: 'livediagram', title: 'Private' });
  h.appCalls = [];
  return { ada, ben, plan, doc, bens };
}

const tab = (item: string, over: Record<string, unknown> = {}) => ({
  kind: 'doc_tab',
  target: { app: 'livediagram', item, title: 'Board' },
  docTemplate: 'flowchart',
  name: 'Release',
  ...over,
});

const pushOf = (step: unknown, over: Partial<AutomationStepPush> = {}) => ({
  key: 'run1:0',
  author: 'user_ada',
  rule: { id: 'r1', name: 'Release Note' },
  from: { title: 'Launch', url: 'https://liveplanner.app/project/p' },
  chain: { id: 'c1', hops: 0, rules: [] },
  step,
  ...over,
});

const push = (itemId: string, payload: unknown, app = 'liveplanner', key = 'lp-key') =>
  call(`/app/items/${itemId}/automation-steps`, {
    method: 'POST',
    auth: key,
    headers: { 'X-Index-App': app },
    body: payload,
  });

const answered = async (itemId: string, payload: unknown) => {
  const res = await push(itemId, payload);
  expect(res.status).toBe(200);
  return body<AutomationStepAnswer>(res);
};

const days = () => h.db.sql.prepare('SELECT person_id, day, count FROM automation_step_days').all();

describe('a step in another app', () => {
  it('asks the target’s door with the author’s own grant and carries the chain on', async () => {
    const { plan, doc } = await world();
    h.appAnswer = () =>
      Response.json({ ok: true, text: 'Added a tab “Release”', link: 'https://x/d' });
    expect(await answered(plan.id, pushOf(tab(doc.id)))).toEqual({
      ok: true,
      text: 'Added a tab “Release”',
      link: 'https://x/d',
    });
    const door = h.appCalls.find((c) => c.url.includes('/automation-step'))!;
    expect(door.url).toBe(
      `https://www.livediagram.app/api/internal/items/${doc.id}/automation-step`,
    );
    expect(door.headers.get('Authorization')).toBe('Bearer ld-key');
    expect(decodeJwt(door.headers.get('X-Index-Grant')!)).toMatchObject({
      sub: 'user_ada',
      aud: 'livediagram',
      item: doc.id,
      level: 'edit',
      tab: null,
    });
    expect(door.body).toEqual({
      author: 'user_ada',
      rule: { id: 'r1', name: 'Release Note', app: 'liveplanner', item: plan.id },
      from: { title: 'Launch', url: 'https://liveplanner.app/project/p' },
      chain: { id: 'c1', hops: 1, rules: [`liveplanner:${plan.id}:r1`] },
      step: tab(doc.id),
    });
    expect(days()).toEqual([
      { person_id: 'user_ada', day: Math.floor(Date.now() / DAY_MS), count: 1 },
    ]);
  });

  it('never reaches an item its author cannot, whoever’s it is', async () => {
    const { plan, bens } = await world();
    expect(await answered(plan.id, pushOf(tab(bens.id)))).toEqual({
      ok: false,
      code: 'no_access',
      reason: '',
    });
    expect(h.appCalls).toEqual([]);
    expect(await answered(plan.id, pushOf(tab('missing-item')))).toMatchObject({
      code: 'no_access',
    });
    expect(days()).toEqual([]);
  });

  it('takes nothing for an item in the Trash or archived', async () => {
    const { plan, doc } = await world();
    h.db.sql.prepare('UPDATE items SET archived_at = 1 WHERE id = ?').run(doc.id);
    expect(await answered(plan.id, pushOf(tab(doc.id)))).toMatchObject({ code: 'no_access' });
    h.db.sql
      .prepare('UPDATE items SET archived_at = NULL, trashed_at = 1 WHERE id = ?')
      .run(doc.id);
    expect(await answered(plan.id, pushOf(tab(doc.id)))).toMatchObject({ code: 'no_access' });
  });

  it('stops a chain that holds this rule, or would take a fourth hop', async () => {
    const { plan, doc } = await world();
    const rules = [`liveplanner:${plan.id}:r1`];
    expect(
      await answered(plan.id, pushOf(tab(doc.id), { chain: { id: 'c', hops: 1, rules } })),
    ).toMatchObject({
      code: 'loop',
    });
    expect(
      await answered(
        plan.id,
        pushOf(tab(doc.id), { chain: { id: 'c', hops: 3, rules: ['a', 'b', 'c'] } }),
      ),
    ).toMatchObject({ code: 'chain_long' });
    expect(h.appCalls).toEqual([]);
  });

  it(`refuses past the author’s ${CROSS_APP_AUTHOR_DAY_MAX} a day, counted across apps`, async () => {
    const { plan, doc } = await world();
    h.db.sql
      .prepare('INSERT INTO automation_step_days (person_id, day, count) VALUES (?, ?, ?)')
      .run('user_ada', Math.floor(Date.now() / DAY_MS), CROSS_APP_AUTHOR_DAY_MAX);
    expect(await answered(plan.id, pushOf(tab(doc.id)))).toMatchObject({ code: 'capped' });
  });

  it('keeps one row a person a day, and drops the ones before yesterday on a day’s first', async () => {
    const now = Date.now();
    h.db.sql
      .prepare(
        'INSERT INTO automation_step_days (person_id, day, count) VALUES (?, ?, ?), (?, ?, ?)',
      )
      .run('user_x', Math.floor(now / DAY_MS) - 5, 9, 'user_y', Math.floor(now / DAY_MS) - 1, 2);
    expect(await countStep(h.db.env, 'user_ada', now)).toBe(1);
    expect(await countStep(h.db.env, 'user_ada', now)).toBe(2);
    expect(
      days()
        .map((r) => (r as { person_id: string }).person_id)
        .sort(),
    ).toEqual(['user_ada', 'user_y']);
  });

  it('refuses a step it cannot read, its own item, and a target of another app', async () => {
    const { plan, doc } = await world();
    for (const bad of [
      null,
      { ...pushOf(tab(doc.id)), author: 'guest_1' },
      { ...pushOf(tab(doc.id)), key: '' },
      { ...pushOf(tab(doc.id)), chain: { id: 'c', hops: 9, rules: [] } },
      { ...pushOf(tab(doc.id)), chain: { id: '', hops: 0, rules: [] } },
      { ...pushOf(tab(doc.id)), chain: { id: 'c', hops: 0, rules: [''] } },
      { ...pushOf(tab(doc.id)), rule: { id: '', name: 'x' } },
      { ...pushOf(tab(doc.id)), from: { title: 3, url: '' } },
      pushOf({ kind: 'nope' }),
      pushOf({ ...tab(doc.id), name: 'x'.repeat(70_000) }),
    ])
      expect((await push(plan.id, bad)).status).toBe(400);
    expect(
      await answered(
        plan.id,
        pushOf(tab(plan.id, { target: { app: 'livediagram', item: plan.id } })),
      ),
    ).toMatchObject({ code: 'invalid', reason: 'A rule acts on its own item with its own steps' });
    expect(
      await answered(
        plan.id,
        pushOf(tab(doc.id, { target: { app: 'liveplanner', item: doc.id } })),
      ),
    ).toMatchObject({ code: 'invalid' });
    expect(await answered(plan.id, pushOf({ ...tab(doc.id), target: null }))).toMatchObject({
      code: 'invalid',
    });
    // A plan card on a livediagram document is not a step the index passes on.
    expect(await answered(plan.id, pushOf({ ...tab(doc.id), kind: 'plan_card' }))).toMatchObject({
      code: 'invalid',
    });
  });

  it('answers what the door said, and no access when the door refused the grant', async () => {
    const { plan, doc } = await world();
    // A fresh answer each time: a tee'd clone's cancel waits on its twin.
    const cases: [() => Response, object][] = [
      [
        () => Response.json({ ok: false, code: 'target_gone', reason: 'The template is gone' }),
        { code: 'target_gone', reason: 'The template is gone' },
      ],
      [() => Response.json({ ok: false, code: 'failed' }), { code: 'failed', reason: '' }],
      [() => Response.json({ ok: 'maybe' }), { code: 'failed' }],
      [() => Response.json({ ok: true, text: 'x', link: 3 }), { ok: true, text: 'x' }],
      [() => Response.json({ error: 'grant_refused' }, { status: 403 }), { code: 'no_access' }],
      [() => new Response(null, { status: 404 }), { code: 'no_access' }],
      [() => new Response(null, { status: 500 }), { code: 'unavailable' }],
    ];
    for (const [res, want] of cases) {
      h.appAnswer = res;
      expect(await answered(plan.id, pushOf(tab(doc.id)))).toMatchObject(want);
    }
  });

  it('is the source item’s own app’s to push', async () => {
    const { plan, doc } = await world();
    expect((await push(plan.id, pushOf(tab(doc.id)), 'livediagram', 'ld-key')).status).toBe(403);
  });
});

describe('Notify', () => {
  const notice = (to: unknown[], text = 'Release is out') => ({ kind: 'inbox_notice', to, text });

  it('reaches the people who can open the item, once a key, and shows in their Inbox', async () => {
    const { ada, plan } = await world();
    const sent = pushOf(
      notice([{ person: 'user_ada' }, { person: 'user_ben' }, { person: 'user_ada' }]),
    );
    expect(await answered(plan.id, sent)).toEqual({
      ok: true,
      text: "Notified 1 person (1 can't open this item)",
    });
    expect(await answered(plan.id, sent)).toMatchObject({ ok: true });
    const inbox = await body<{ notices: unknown[] }>(await call('/inbox', { auth: ada.auth }));
    expect(inbox.notices).toEqual([
      {
        id: expect.stringMatching(/^an:/),
        app: 'liveplanner',
        itemId: plan.id,
        itemTitle: 'Launch',
        rule: 'Release Note',
        text: 'Release is out',
        at: expect.any(Number),
      },
    ]);
  });

  it('says so when nobody can open it, or there is nobody to tell', async () => {
    const { plan } = await world();
    expect(await answered(plan.id, pushOf(notice([{ person: 'user_ben' }])))).toMatchObject({
      code: 'no_access',
    });
    expect(await answered(plan.id, pushOf(notice([{ value: 'Ben' }])))).toMatchObject({
      code: 'invalid',
    });
    expect(await answered(plan.id, pushOf(notice([{ person: 'user_ada' }], ' ')))).toMatchObject({
      code: 'invalid',
    });
    const two = pushOf(notice([{ person: 'user_ada' }, { person: 'user_ada' }]), {
      key: 'k2',
      rule: { id: 'r', name: ' ' },
    });
    expect(await answered(plan.id, two)).toEqual({ ok: true, text: 'Notified 1 person' });
  });

  it('reads only accounts from a step’s people', () => {
    expect(noticePeople('x')).toEqual([]);
    expect(
      noticePeople([{ person: 'user_a' }, null, { person: 'guest_b' }, { value: 'c' }]),
    ).toEqual(['user_a']);
  });
});

describe('a target’s pickers', () => {
  it('ask the target’s door with the person’s own grant, an Editor’s alone', async () => {
    const { ada, ben, doc } = await world();
    h.appAnswer = () => Response.json({ templates: [{ id: 'flowchart', name: 'Flowchart' }] });
    const res = await call(`/items/${doc.id}/automation-target`, { auth: ada.auth });
    expect(await body(res)).toEqual({
      app: 'livediagram',
      title: 'Board',
      templates: [{ id: 'flowchart', name: 'Flowchart' }],
    });
    const door = h.appCalls.at(-1)!;
    expect(door.url).toBe(
      `https://www.livediagram.app/api/internal/items/${doc.id}/automation-target`,
    );
    expect(decodeJwt(door.headers.get('X-Index-Grant')!)).toMatchObject({
      sub: 'user_ada',
      item: doc.id,
    });
    expect((await call(`/items/${doc.id}/automation-target`, { auth: ben.auth })).status).toBe(404);
    h.appAnswer = () => new Response(null, { status: 500 });
    expect((await call(`/items/${doc.id}/automation-target`, { auth: ada.auth })).status).toBe(502);
  });
});
