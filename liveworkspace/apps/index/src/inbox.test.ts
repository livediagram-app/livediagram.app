// The Inbox's rows beyond an element's: why a thread is on the page (mentioned, commented, the item is mine),
// cards and their threads pushed under the item's cards tab, forms with unseen responses, and the read's budget.
import {
  COLLAB_CARDS_TAB,
  type CollabActionInput,
  type CollabCard,
  type CollabThreadInput,
  type InboxResponse,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const asApp = (path: string, payload: unknown, app = 'liveplanner', key = 'lp-key') =>
  call(path, { method: 'PUT', auth: key, headers: { 'X-Index-App': app }, body: payload });

const inbox = async (auth: string, query = '') =>
  body<InboxResponse>(await call(`/inbox${query}`, { auth }));

const thread = (patch: Partial<CollabThreadInput> = {}): CollabThreadInput => ({
  elementId: 'el-1',
  elementLabel: 'Card',
  resolved: false,
  commentCount: 2,
  participantIds: ['user_a', 'user_b'],
  mentionedIds: [],
  latestText: 'Looks good',
  latestAuthorName: 'Bob',
  firstAt: 1,
  latestAt: 2,
  ...patch,
});

const action = (patch: Partial<CollabActionInput> = {}): CollabActionInput => ({
  elementId: 'el-1',
  actionId: 'act-1',
  elementLabel: 'Card',
  name: 'Write it up',
  status: 'open',
  assigneeId: 'user_b',
  assignerId: 'user_a',
  teamId: null,
  createdAt: 1,
  updatedAt: 2,
  ...patch,
});

const card: CollabCard = {
  key: 12,
  type: 'task',
  typeLabel: 'Task',
  title: 'Ship it',
  board: { tabId: 'tab-1', elementId: 'board-1', title: 'Sprint', tabName: 'Board' },
};

describe('Inbox threads', () => {
  it('say why each is there, with the tab’s name and the latest author’s colour', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const item = await makeItem(ada.auth, { title: 'Plan', teamId: 'team1' });
    await asApp(`/app/items/${item.id}/collab/t1`, {
      tabName: 'Roadmap',
      threads: [
        thread({ elementId: 'mention', participantIds: ['user_a'], mentionedIds: ['user_b'] }),
        thread({ elementId: 'mine', participantIds: ['user_b'], latestAuthorColor: '#ff0000' }),
        thread({ elementId: 'owned', participantIds: ['user_c'] }),
      ],
      actions: [],
    });
    const forBob = await inbox(bob.auth);
    const bobs = Object.fromEntries(forBob.threads.map((t) => [t.elementId, t]));
    expect(Object.keys(bobs).sort()).toEqual(['mention', 'mine']);
    expect(bobs.mention).toMatchObject({
      mentionsYou: true,
      youCommented: false,
      onYourItem: false,
    });
    expect(bobs.mine).toMatchObject({
      mentionsYou: false,
      youCommented: true,
      latestAuthorColor: '#ff0000',
      tabName: 'Roadmap',
      itemTeamId: 'team1',
      card: null,
    });
    const forAda = await inbox(ada.auth);
    const owned = forAda.threads.find((t) => t.elementId === 'owned')!;
    expect(owned).toMatchObject({ onYourItem: true, youCommented: false, mentionsYou: false });
  });

  it('carry an action’s notes and names', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await asApp(`/app/items/${item.id}/collab/t1`, {
      threads: [],
      actions: [
        action({
          assigneeId: 'user_a',
          description: 'By Friday',
          assigneeName: 'Ada',
          assignerName: 'Bob',
        }),
      ],
    });
    const [row] = (await inbox(ada.auth)).actions;
    expect(row).toMatchObject({
      description: 'By Friday',
      assigneeName: 'Ada',
      assignerName: 'Bob',
      card: null,
      tabName: '',
    });
  });
});

describe('Inbox cards', () => {
  it('list cards assigned to me and card threads, pushed under the cards tab, apart from the tabs’', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth, { title: 'Plan' });
    const { link } = await body<{ link: { code: string } }>(
      await call(`/items/${item.id}/share`, {
        method: 'POST',
        auth: ada.auth,
        body: { level: 'edit' },
      }),
    );
    await call(`/share/${link.code}`, { auth: bob.auth });
    await asApp(`/app/items/${item.id}/collab/tab-1`, {
      threads: [thread({ elementId: 'el-9', participantIds: ['user_b'] })],
      actions: [],
    });
    const cards = `/app/items/${item.id}/collab/${COLLAB_CARDS_TAB}`;
    expect(
      (
        await asApp(cards, {
          threads: [
            thread({
              elementId: 'card-1',
              participantIds: ['user_a'],
              mentionedIds: ['user_b'],
              card,
            }),
          ],
          actions: [
            action({
              elementId: 'card-1',
              actionId: 'card-1',
              name: '#12 Ship it',
              elementLabel: 'Sprint',
              assigneeId: 'user_b',
              card,
            }),
            action({
              elementId: 'card-2',
              actionId: 'card-2',
              assigneeId: 'user_b',
              card: { ...card, key: 13, board: null },
            }),
          ],
        })
      ).status,
    ).toBe(204);
    const forBob = await inbox(bob.auth);
    expect(forBob.actions.map((a) => [a.elementId, a.card?.key, a.card?.board?.elementId])).toEqual(
      [
        ['card-1', 12, 'board-1'],
        ['card-2', 13, undefined],
      ],
    );
    expect(forBob.threads.map((t) => [t.elementId, t.card?.title ?? null, t.mentionsYou])).toEqual([
      ['el-9', null, false],
      ['card-1', 'Ship it', true],
    ]);
    // A later cards push replaces the cards, and leaves the tabs' rows.
    await asApp(cards, { threads: [], actions: [] });
    const after = await inbox(bob.auth);
    expect(after.actions).toEqual([]);
    expect(after.threads.map((t) => t.elementId)).toEqual(['el-9']);
  });

  it('refuse a malformed card', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const res = await asApp(`/app/items/${item.id}/collab/${COLLAB_CARDS_TAB}`, {
      threads: [],
      actions: [action({ card: { ...card, board: { tabId: '', elementId: 'b' } } as never })],
    });
    expect(await body(res)).toEqual({ error: 'invalid_collab' });
  });
});

describe('Inbox forms', () => {
  it('list forms with unseen responses on items I own or my team’s, until I have seen them', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const cat = await person('user_c');
    const own = await makeItem(ada.auth, { title: 'Survey' });
    const team = await makeItem(ada.auth, { title: 'Team survey', teamId: 'team1' });
    const form = (responses: number, latestAt: number) => ({
      form: { heading: 'Bug Report', boardTabId: 'board-tab', responses, latestAt },
    });
    expect((await asApp(`/app/items/${own.id}/forms/f1`, form(3, 10))).status).toBe(204);
    await asApp(`/app/items/${team.id}/forms/f2`, form(2, 20));

    expect((await inbox(ada.auth)).forms.map((f) => [f.itemTitle, f.unseen])).toEqual([
      ['Team survey', 2],
      ['Survey', 3],
    ]);
    expect((await inbox(bob.auth)).forms.map((f) => f.itemId)).toEqual([team.id]);
    expect((await inbox(cat.auth)).forms).toEqual([]);
    expect((await inbox(ada.auth)).forms[1]).toMatchObject({
      app: 'liveplanner',
      tabId: 'f1',
      heading: 'Bug Report',
      boardTabId: 'board-tab',
      itemTeamId: null,
      latestAt: 10,
    });

    // Ada reads the first; a seen count never goes back.
    await asApp(`/app/items/${own.id}/forms/f1/seen`, { personId: 'user_a', seen: 3 });
    await asApp(`/app/items/${own.id}/forms/f1/seen`, { personId: 'user_a', seen: 1 });
    expect((await inbox(ada.auth)).forms.map((f) => f.tabId)).toEqual(['f2']);
    // A new response brings it back with one unseen.
    await asApp(`/app/items/${own.id}/forms/f1`, form(4, 30));
    expect((await inbox(ada.auth)).forms.map((f) => [f.tabId, f.unseen])).toEqual([
      ['f1', 1],
      ['f2', 2],
    ]);
    // This app's only, and gone with `form: null`.
    expect((await inbox(ada.auth, '?app=livediagram')).forms).toEqual([]);
    await asApp(`/app/items/${own.id}/forms/f1`, { form: null });
    expect((await inbox(ada.auth)).forms.map((f) => f.tabId)).toEqual(['f2']);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM collab_form_reads').get()).toEqual({ n: 0 });
  });

  it('refuse a malformed form or seen count, and another app’s item', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    expect(
      await body(await asApp(`/app/items/${item.id}/forms/f1`, { form: { heading: 1 } })),
    ).toEqual({
      error: 'invalid_form',
    });
    expect(
      await body(
        await asApp(`/app/items/${item.id}/forms/f1/seen`, { personId: 'user_a', seen: -1 }),
      ),
    ).toEqual({ error: 'invalid_form_seen' });
    const form = { form: { heading: 'H', boardTabId: null, responses: 1, latestAt: 1 } };
    expect(
      (await asApp(`/app/items/${item.id}/forms/f1`, form, 'livediagram', 'ld-key')).status,
    ).toBe(403);
  });
  it('find a live form by its code, for its own app only, and read how far a person has seen it', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const asGet = (path: string, app = 'liveplanner', key = 'lp-key') =>
      call(path, { auth: key, headers: { 'X-Index-App': app } });
    const form = (patch: Record<string, unknown> = {}) => ({
      form: { heading: 'H', boardTabId: null, responses: 2, latestAt: 1, ...patch },
    });
    expect((await asApp(`/app/items/${item.id}/forms/f1`, form({ code: 'Ab3_x' }))).status).toBe(
      204,
    );
    expect(await body(await asGet('/app/forms/Ab3_x'))).toEqual({ itemId: item.id, tabId: 'f1' });
    // A push without a code keeps it; another app, an unknown or a malformed code is missing.
    await asApp(`/app/items/${item.id}/forms/f1`, form({ responses: 3 }));
    expect((await asGet('/app/forms/Ab3_x')).status).toBe(200);
    expect((await asGet('/app/forms/Ab3_x', 'livediagram', 'ld-key')).status).toBe(404);
    expect((await asGet('/app/forms/nope')).status).toBe(404);
    expect((await asGet('/app/forms/a.b')).status).toBe(404);
    expect(
      await body(await asApp(`/app/items/${item.id}/forms/f1`, form({ code: 'bad code' }))),
    ).toEqual({ error: 'invalid_form' });

    expect(await body(await asGet(`/app/items/${item.id}/forms/f1/seen/user_a`))).toEqual({
      seen: 0,
    });
    await asApp(`/app/items/${item.id}/forms/f1/seen`, { personId: 'user_a', seen: 2 });
    expect(await body(await asGet(`/app/items/${item.id}/forms/f1/seen/user_a`))).toEqual({
      seen: 2,
    });
    expect(
      (await asGet(`/app/items/${item.id}/forms/f1/seen/user_a`, 'livediagram', 'ld-key')).status,
    ).toBe(403);

    // Taken off the Inbox, the code goes with it.
    await asApp(`/app/items/${item.id}/forms/f1`, { form: null });
    expect((await asGet('/app/forms/Ab3_x')).status).toBe(404);
  });
  it('follow a guest into their account, keeping the further read', async () => {
    const owner = await person('user_o', { teams: [{ id: 'team1' }] });
    await person('guest_g1', { guest: true });
    await person('user_u1', { teams: [{ id: 'team1' }] });
    const item = await makeItem(owner.auth, { title: 'Team survey', teamId: 'team1' });
    const form = { form: { heading: 'H', boardTabId: null, responses: 5, latestAt: 1 } };
    await asApp(`/app/items/${item.id}/forms/f1`, form);
    await asApp(`/app/items/${item.id}/forms/f1/seen`, { personId: 'guest_g1', seen: 4 });
    await asApp(`/app/items/${item.id}/forms/f1/seen`, { personId: 'user_u1', seen: 2 });
    await call('/internal/merge', {
      method: 'POST',
      auth: 'merge-key',
      body: { guestId: 'guest_g1', userId: 'user_u1' },
    });
    expect(
      h.db.sql.prepare('SELECT person_id, seen FROM collab_form_reads ORDER BY person_id').all(),
    ).toEqual([{ person_id: 'user_u1', seen: 4 }]);
  });
});

describe('the Inbox at scale', () => {
  it('reads within budget with 2,000 of my items among 22,000, each with a form, a thread and an action', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const db = h.db.sql;
    const items = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', ?, ?, ?, NULL, ?, '{}', ?, ?)`,
    );
    const forms = db.prepare(
      `INSERT INTO collab_forms (app, item_id, tab_id, heading, board_tab_id, responses, latest_at)
       VALUES ('liveplanner', ?, 'f', 'Form', NULL, 3, ?)`,
    );
    const threads = db.prepare(
      `INSERT INTO collab_threads (app, item_id, tab_id, element_id, element_label, resolved, comment_count,
         participant_ids, mentioned_ids, latest_text, latest_author_name, first_at, latest_at)
       VALUES ('liveplanner', ?, 't', 'e', 'E', 0, 1, ?, '[]', 'hi', 'Bob', 1, ?)`,
    );
    const actions = db.prepare(
      `INSERT INTO collab_actions (app, item_id, tab_id, element_id, action_id, element_label, name, status,
         assignee_id, assigner_id, team_id, created_at, updated_at)
       VALUES ('liveplanner', ?, 't', 'e', 'a', 'E', 'Do', 'open', ?, 'user_x', NULL, 1, ?)`,
    );
    db.exec('BEGIN');
    for (let i = 0; i < 22_000; i++) {
      const mine = i % 11 === 0;
      const owner = mine ? 'user_a' : `user_${i % 500}x`;
      const id = `item-${i}`;
      items.run(id, owner, null, `p:${owner}`, `Item ${i}`, i, i);
      forms.run(id, i);
      threads.run(id, JSON.stringify([owner]), i);
      actions.run(id, owner, i);
    }
    db.exec('COMMIT');
    const started = performance.now();
    const runs = 10;
    let res: InboxResponse | null = null;
    for (let i = 0; i < runs; i++) res = await inbox(ada.auth);
    const ms = (performance.now() - started) / runs;
    expect(res!.forms.length).toBe(100);
    expect(res!.threads.length).toBe(100);
    expect(res!.actions.length).toBe(100);
    // Measured about 18 ms a read here (three queries and the Timeline count); the budget leaves room for a slow machine.
    expect(ms).toBeLessThan(150);
  });
});
