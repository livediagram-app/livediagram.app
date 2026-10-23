import { describe, expect, it, vi } from 'vitest';
import {
  ANONYMISED_PERSON,
  budgetOf,
  continuePurges,
  LINGER_MS,
  purgePerson,
  TOMBSTONE_RETRY_AFTER_MS,
} from './account-purge';
import { drainPersonNotices, NOTICE_GIVE_UP_MS, NOTICE_RETRY_AFTER_MS } from './person-notices';
import { body, call, h, settle, useHarness } from './test-support';

useHarness();

const ADA = 'user_ada';
const BEA = 'user_bea';

const purge = (payload: unknown, auth: string | null = 'merge-key') =>
  call('/internal/purge-person', { method: 'POST', auth, body: payload });

function addItem(
  id: string,
  owner: string,
  options: { team?: string; folder?: string; trashed?: boolean; app?: string } = {},
) {
  const app = options.app ?? 'liveplanner';
  h.db.sql
    .prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, created_at, updated_at,
                          trashed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
    )
    .run(
      id,
      app,
      app === 'liveplanner' ? 'plan' : 'canvas',
      owner,
      options.team ?? null,
      options.team ? `t:${options.team}` : `p:${owner}`,
      options.folder ?? null,
      id,
      options.trashed ? 1 : null,
    );
}

function addFolder(id: string, owner: string, team?: string) {
  h.db.sql
    .prepare(
      `INSERT INTO folders (id, name, parent_id, owner_id, team_id, scope, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, 1, 1)`,
    )
    .run(id, id, owner, team ?? null, team ? `t:${team}` : `p:${owner}`);
}

const run = (query: string, ...args: (string | number | null)[]) =>
  h.db.sql.prepare(query).run(...args);
const rows = (query: string, ...args: (string | number | null)[]) =>
  h.db.sql.prepare(query).all(...args) as Record<string, unknown>[];
const count = (query: string, ...args: (string | number | null)[]) =>
  Number((h.db.sql.prepare(query).get(...args) as { n: number }).n);

// Ada's whole world, beside Bea's: personal items and folders, a team that outlives her (T) and one that
// closed with her (D), tags, favourites, opens, Shared with me, a placement default, and the Inbox.
function arrange() {
  addFolder('f-ada', ADA);
  addFolder('f-ada-team', ADA, 'T');
  addFolder('f-ada-gone', ADA, 'D');
  addFolder('f-bea', BEA);
  addItem('ada-1', ADA, { folder: 'f-ada' });
  addItem('ada-2', ADA, { trashed: true, app: 'livediagram' });
  addItem('ada-team', ADA, { team: 'T', folder: 'f-ada-team' });
  addItem('ada-gone', ADA, { team: 'D', folder: 'f-ada-gone' });
  addItem('bea-gone', BEA, { team: 'D', folder: 'f-ada-gone' });
  addItem('bea-1', BEA, { folder: 'f-bea' });
  run(
    `INSERT INTO tags (id, owner_id, name, colour, created_at, updated_at) VALUES ('tag-ada', ?, 'a', 'red', 1, 1)`,
    ADA,
  );
  run(
    `INSERT INTO tags (id, owner_id, name, colour, created_at, updated_at) VALUES ('tag-bea', ?, 'b', 'red', 1, 1)`,
    BEA,
  );
  run(
    `INSERT INTO item_tags (tag_id, item_id, created_at) VALUES ('tag-ada', 'bea-1', 1), ('tag-bea', 'bea-1', 1)`,
  );
  for (const [person, item] of [
    [ADA, 'bea-1'],
    [BEA, 'bea-1'],
    [BEA, 'ada-1'],
  ]) {
    run('INSERT INTO favourites (person_id, item_id, created_at) VALUES (?, ?, 1)', person!, item!);
    run('INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, ?, 1)', person!, item!);
  }
  run(
    `INSERT INTO share_links (code, item_id, level, created_at) VALUES ('code-bea', 'bea-1', 'view', 1)`,
  );
  run(
    `INSERT INTO share_links (code, item_id, level, created_at) VALUES ('code-ada', 'ada-1', 'view', 1)`,
  );
  run(
    `INSERT INTO shared_with (person_id, item_id, share_code, last_seen) VALUES (?, 'bea-1', 'code-bea', 1)`,
    ADA,
  );
  run(
    `INSERT INTO shared_with (person_id, item_id, share_code, last_seen) VALUES (?, 'ada-1', 'code-ada', 1)`,
    BEA,
  );
  run(
    `INSERT INTO placement_defaults (person_id, default_key, folder_id, updated_at) VALUES (?, 'k', 'f-bea', 1)`,
    ADA,
  );
  run(
    `INSERT INTO placement_defaults (person_id, default_key, folder_id, updated_at) VALUES (?, 'k', 'f-bea', 1)`,
    BEA,
  );
  // A thread on Bea's item that Ada is in and is mentioned in, and one on Ada's own item.
  for (const item of ['bea-1', 'ada-1']) {
    run(
      `INSERT INTO collab_threads (app, item_id, tab_id, element_id, element_label, resolved, comment_count,
         participant_ids, mentioned_ids, latest_text, latest_author_name, first_at, latest_at)
       VALUES ('liveplanner', ?, 'tab', 'el', 'Box', 0, 2, ?, ?, 'hi', 'Bea', 1, 1)`,
      item,
      JSON.stringify([BEA, ADA]),
      JSON.stringify([ADA]),
    );
    for (const person of [ADA, BEA]) {
      run(
        `INSERT INTO collab_thread_people (app, item_id, tab_id, element_id, person_id)
         VALUES ('liveplanner', ?, 'tab', 'el', ?)`,
        item,
        person,
      );
    }
  }
  run(
    `INSERT INTO collab_actions (app, item_id, tab_id, element_id, action_id, element_label, name, status,
       assignee_id, assigner_id, created_at, updated_at)
     VALUES ('liveplanner', 'bea-1', 'tab', 'el', 'a1', 'Box', 'Do it', 'open', ?, ?, 1, 1),
            ('liveplanner', 'bea-1', 'tab', 'el', 'a2', 'Box', 'And this', 'open', ?, ?, 1, 1)`,
    ADA,
    BEA,
    BEA,
    ADA,
  );
}

// Everything that still names Ada, anywhere.
function mentionsOfAda(): number {
  return (
    count('SELECT COUNT(*) AS n FROM items WHERE owner_id = ?', ADA) +
    count('SELECT COUNT(*) AS n FROM folders WHERE owner_id = ?', ADA) +
    count('SELECT COUNT(*) AS n FROM tags WHERE owner_id = ?', ADA) +
    count('SELECT COUNT(*) AS n FROM favourites WHERE person_id = ?', ADA) +
    count('SELECT COUNT(*) AS n FROM opens WHERE person_id = ?', ADA) +
    count('SELECT COUNT(*) AS n FROM shared_with WHERE person_id = ?', ADA) +
    count('SELECT COUNT(*) AS n FROM placement_defaults WHERE person_id = ?', ADA) +
    count('SELECT COUNT(*) AS n FROM collab_thread_people WHERE person_id = ?', ADA) +
    count(
      'SELECT COUNT(*) AS n FROM collab_actions WHERE assignee_id = ? OR assigner_id = ?',
      ADA,
      ADA,
    ) +
    count(
      `SELECT COUNT(*) AS n FROM collab_threads
       WHERE participant_ids LIKE '%' || ? || '%' OR mentioned_ids LIKE '%' || ? || '%'`,
      ADA,
      ADA,
    )
  );
}

describe('POST /internal/purge-person', () => {
  it("takes accounts' key only, and a well-formed person", async () => {
    expect((await purge({ personId: ADA }, null)).status).toBe(401);
    expect((await purge({ personId: ADA }, 'ld-key')).status).toBe(401);
    expect((await purge({ personId: 'link:abc' })).status).toBe(400);
    expect((await purge({ personId: ADA, teamIds: 'D' })).status).toBe(400);
    expect((await purge({ personId: ADA, teamIds: [1] })).status).toBe(400);
  });

  it('purges everything that is theirs and anonymises what only names them', async () => {
    arrange();
    const res = await purge({ personId: ADA, teamIds: ['D'] });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ done: true, items: 3 });
    await settle();

    expect(mentionsOfAda()).toBe(0);
    // Her items, the Trash included and the one in the team that closed with her, are gone, with
    // what hung off them; the apps were asked to drop each one's content.
    expect(rows('SELECT id FROM items ORDER BY id').map((r) => r.id)).toEqual([
      'ada-team',
      'bea-1',
      'bea-gone',
    ]);
    expect(count(`SELECT COUNT(*) AS n FROM share_links WHERE code = 'code-ada'`)).toBe(0);
    expect(count(`SELECT COUNT(*) AS n FROM collab_threads WHERE item_id = 'ada-1'`)).toBe(0);
    expect(
      h.appCalls
        .filter((c) => c.method === 'DELETE')
        .map((c) => `${c.method} ${c.url}`)
        .sort(),
    ).toEqual([
      'DELETE https://livediagram.app/api/internal/items/ada-2',
      'DELETE https://liveplanner.app/api/internal/items/ada-1',
      'DELETE https://liveplanner.app/api/internal/items/ada-gone',
    ]);
    expect(count('SELECT COUNT(*) AS n FROM purge_tombstones')).toBe(0);
    // Each app heard of her once, with the items of others that name her: her team plan (her own work in it
    // stays with the team) and Bea's, where she commented and was given and gave actions.
    const told = h.appCalls.filter((c) => c.url.includes('/api/internal/people/'));
    expect(told.map((c) => c.url)).toContain(
      `https://livediagram.app/api/internal/people/${ADA}/purge`,
    );
    expect(new Set(told.map((c) => c.url)).size).toBe(told.length);
    const planner = told.find((c) => c.url.startsWith('https://liveplanner.app'))!;
    expect(planner.body).toEqual({ items: ['ada-team', 'bea-1'] });
    expect(count('SELECT COUNT(*) AS n FROM person_app_notices')).toBe(0);

    // Team work stays with the team, under an anonymised owner.
    expect(rows(`SELECT owner_id, folder_id FROM items WHERE id = 'ada-team'`)).toEqual([
      { owner_id: ANONYMISED_PERSON, folder_id: 'f-ada-team' },
    ]);
    expect(rows(`SELECT owner_id FROM folders WHERE id = 'f-ada-team'`)).toEqual([
      { owner_id: ANONYMISED_PERSON },
    ]);
    // Bea's item in the closed team stays hers, out of Ada's folder.
    expect(rows(`SELECT owner_id, folder_id FROM items WHERE id = 'bea-gone'`)).toEqual([
      { owner_id: BEA, folder_id: null },
    ]);

    // The Inbox rows on Bea's item keep their shape, naming nobody.
    expect(
      rows(`SELECT participant_ids, mentioned_ids FROM collab_threads WHERE item_id = 'bea-1'`),
    ).toEqual([
      {
        participant_ids: JSON.stringify([BEA, ANONYMISED_PERSON]),
        mentioned_ids: JSON.stringify([ANONYMISED_PERSON]),
      },
    ]);
    expect(
      rows('SELECT action_id, assignee_id, assigner_id FROM collab_actions ORDER BY action_id'),
    ).toEqual([
      { action_id: 'a1', assignee_id: ANONYMISED_PERSON, assigner_id: BEA },
      { action_id: 'a2', assignee_id: BEA, assigner_id: ANONYMISED_PERSON },
    ]);

    // Bea's own things are untouched.
    expect(count('SELECT COUNT(*) AS n FROM favourites WHERE person_id = ?', BEA)).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM opens WHERE person_id = ?', BEA)).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM placement_defaults WHERE person_id = ?', BEA)).toBe(1);
    expect(rows('SELECT tag_id FROM item_tags').map((r) => r.tag_id)).toEqual(['tag-bea']);
    expect(count('SELECT COUNT(*) AS n FROM collab_thread_people WHERE person_id = ?', BEA)).toBe(
      1,
    );
  });

  it("drops the person's use days (Most Used), on others' items too, and leaves everyone else's", async () => {
    addItem('bea-used', BEA);
    addItem('ada-used', ADA);
    const use = (person: string, item: string, day: number) =>
      run('INSERT INTO use_days (person_id, item_id, day) VALUES (?, ?, ?)', person, item, day);
    use(ADA, 'bea-used', 20_000);
    use(ADA, 'bea-used', 20_001);
    use(ADA, 'ada-used', 20_001);
    use(BEA, 'bea-used', 20_001);
    expect((await purge({ personId: ADA, teamIds: [] })).status).toBe(200);
    await settle();
    expect(count('SELECT COUNT(*) AS n FROM use_days WHERE person_id = ?', ADA)).toBe(0);
    expect(rows('SELECT person_id, item_id FROM use_days')).toEqual([
      { person_id: BEA, item_id: 'bea-used' },
    ]);
  });

  it('deletes the Timeline only they see, and takes their name off what others still see', async () => {
    addItem('ada-own', ADA);
    addItem('ada-in-team', ADA, { team: 'T' });
    addItem('bea-own', BEA);
    addItem('bea-team', BEA, { team: 'T' });
    const event = (id: string, item: string, actor: string, scope: string, type = 'edited') => {
      run(
        `INSERT INTO timeline_events (id, app, item_id, actor_id, actor_name, type, title, occurred_at)
         VALUES (?, 'liveplanner', ?, ?, ?, ?, ?, 1)`,
        id,
        item,
        actor,
        actor === ADA ? 'Ada' : 'Bea',
        type,
        item,
      );
      run(
        `INSERT INTO timeline_event_scopes (scope, event_id, app, occurred_at) VALUES (?, ?, 'liveplanner', 1)`,
        scope,
        id,
      );
    };
    event('e-own', 'ada-own', ADA, `p:${ADA}`); // her own item: goes with it
    event('e-fav', 'bea-own', ADA, `p:${ADA}`, 'favourited'); // only she saw it
    event('e-team', 'ada-in-team', ADA, 't:T'); // the team keeps it, unnamed
    event('e-edit', 'bea-team', ADA, 't:T'); // her edit on Bea's team item, unnamed
    event('e-bea', 'bea-own', BEA, `p:${BEA}`); // Bea's own, untouched
    event('e-bea-ada', 'ada-in-team', BEA, 't:T'); // Bea's on Ada's team item, untouched
    run('INSERT INTO timeline_scope_state (person_id, last_seen_at) VALUES (?, 5)', ADA);
    run('INSERT INTO timeline_scope_state (person_id, last_seen_at) VALUES (?, 5)', BEA);

    expect((await purge({ personId: ADA, teamIds: [] })).status).toBe(200);
    await settle();
    expect(rows('SELECT id, actor_id, actor_name FROM timeline_events ORDER BY id')).toEqual([
      { id: 'e-bea', actor_id: BEA, actor_name: 'Bea' },
      { id: 'e-bea-ada', actor_id: BEA, actor_name: 'Bea' },
      { id: 'e-edit', actor_id: ANONYMISED_PERSON, actor_name: null },
      { id: 'e-team', actor_id: ANONYMISED_PERSON, actor_name: null },
    ]);
    expect(rows('SELECT scope, event_id FROM timeline_event_scopes ORDER BY event_id')).toEqual([
      { scope: `p:${BEA}`, event_id: 'e-bea' },
      { scope: 't:T', event_id: 'e-bea-ada' },
      { scope: 't:T', event_id: 'e-edit' },
      { scope: 't:T', event_id: 'e-team' },
    ]);
    expect(rows('SELECT person_id FROM timeline_scope_state')).toEqual([{ person_id: BEA }]);
  });

  it('is safe to run again, and remembers the request until the linger window ends', async () => {
    arrange();
    await purge({ personId: ADA, teamIds: ['D'] });
    const again = await purge({ personId: ADA, teamIds: ['D'] });
    expect(await body(again)).toEqual({ done: true, items: 0 });
    expect(rows('SELECT team_ids FROM person_purges WHERE person_id = ?', ADA)).toEqual([
      { team_ids: '["D"]' },
    ]);

    // Something written after the purge, with a token issued before the account closed, goes on the
    // next run; past the linger window the request is forgotten.
    addItem('ada-late', ADA);
    const later = Date.now() + LINGER_MS + 1;
    await continuePurges(h.db.env, later);
    expect(count(`SELECT COUNT(*) AS n FROM items WHERE id = 'ada-late'`)).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM person_purges')).toBe(0);
  });

  it('a call that runs out of budget is finished by the cron', async () => {
    for (let i = 0; i < 1_200; i++) addItem(`ada-${i}`, ADA);
    run(
      `INSERT INTO person_purges (person_id, team_ids, requested_at) VALUES (?, '[]', ?)`,
      ADA,
      Date.now(),
    );
    const first = await purgePerson(h.db.env, ADA, [], { deadline: Date.now() + 60_000, calls: 4 });
    expect(first).toMatchObject({ done: false, items: 500 });
    expect(count('SELECT COUNT(*) AS n FROM items WHERE owner_id = ?', ADA)).toBe(700);

    const cron = await continuePurges(h.db.env);
    expect(cron).toMatchObject({ persons: 1, finished: 1 });
    expect(count('SELECT COUNT(*) AS n FROM items WHERE owner_id = ?', ADA)).toBe(0);
    // Inside the linger window the request stays, marked finished.
    expect(rows('SELECT finished_at IS NOT NULL AS finished FROM person_purges')).toEqual([
      { finished: 1 },
    ]);
  });

  it('the cron tells the apps about fresh tombstones, and retries a failed one after an hour', async () => {
    addItem('ada-1', ADA);
    addItem('ada-2', ADA);
    await purgePerson(h.db.env, ADA, [], budgetOf({ ms: 60_000, calls: 100 }));
    h.appAnswer = (c) => new Response(null, { status: c.url.endsWith('ada-2') ? 503 : 200 });
    const now = Date.now();
    expect((await continuePurges(h.db.env, now)).confirmed).toBe(1);
    expect(rows('SELECT item_id, attempts FROM purge_tombstones')).toEqual([
      { item_id: 'ada-2', attempts: 1 },
    ]);

    h.appCalls = [];
    h.appAnswer = () => new Response(null, { status: 200 });
    // Too soon: left alone.
    expect((await continuePurges(h.db.env, now + 60_000)).confirmed).toBe(0);
    expect(h.appCalls).toHaveLength(0);
    expect((await continuePurges(h.db.env, now + TOMBSTONE_RETRY_AFTER_MS + 1)).confirmed).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM purge_tombstones')).toBe(0);
  });

  // Worst case: 50,000 items, each favourited, opened and tagged, plus 5,000 threads and actions on
  // someone else's items. Measured, and the call budget must hold.
  it('purges 50,000 items within the per-call D1 budget', async () => {
    const N = 50_000;
    run(
      `INSERT INTO tags (id, owner_id, name, colour, created_at, updated_at) VALUES ('tag-ada', ?, 'a', 'red', 1, 1)`,
      ADA,
    );
    addItem('bea-1', BEA);
    const insert = h.db.sql.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, title, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', ?, NULL, ?, 't', 1, 1)`,
    );
    h.db.sql.exec('BEGIN');
    for (let i = 0; i < N; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      insert.run(id, ADA, `p:${ADA}`);
      run('INSERT INTO favourites (person_id, item_id, created_at) VALUES (?, ?, 1)', ADA, id);
      run('INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, ?, 1)', ADA, id);
      run(`INSERT INTO item_tags (tag_id, item_id, created_at) VALUES ('tag-ada', ?, 1)`, id);
    }
    for (let i = 0; i < 5_000; i++) {
      run(
        `INSERT INTO collab_threads (app, item_id, tab_id, element_id, element_label, resolved, comment_count,
           participant_ids, mentioned_ids, latest_text, latest_author_name, first_at, latest_at)
         VALUES ('liveplanner', 'bea-1', 'tab', ?, 'Box', 0, 1, ?, '[]', 'hi', 'Bea', 1, 1)`,
        `el-${i}`,
        JSON.stringify([BEA, ADA]),
      );
      run(
        `INSERT INTO collab_thread_people (app, item_id, tab_id, element_id, person_id)
         VALUES ('liveplanner', 'bea-1', 'tab', ?, ?)`,
        `el-${i}`,
        ADA,
      );
      run(
        `INSERT INTO collab_actions (app, item_id, tab_id, element_id, action_id, element_label, name, status,
           assignee_id, assigner_id, created_at, updated_at)
         VALUES ('liveplanner', 'bea-1', 'tab', ?, 'a', 'Box', 'Do', 'open', ?, ?, 1, 1)`,
        `el-${i}`,
        ADA,
        BEA,
      );
    }
    h.db.sql.exec('COMMIT');

    const budget = { deadline: Date.now() + 120_000, calls: 300 };
    const started = performance.now();
    const outcome = await purgePerson(h.db.env, ADA, [], budget);
    const ms = performance.now() - started;
    const calls = 300 - budget.calls;
    console.log(`[purge 50k] ${ms.toFixed(0)} ms, ${calls} D1 calls, done ${outcome.done}`);

    expect(outcome).toMatchObject({ done: true, items: N });
    expect(calls).toBeLessThanOrEqual(300);
    expect(mentionsOfAda()).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM purge_tombstones')).toBe(N);
    expect(count('SELECT COUNT(*) AS n FROM favourites')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM collab_threads')).toBe(5_000);
    // A generous ceiling for a slow CI machine; locally it is a few seconds.
    expect(ms).toBeLessThan(60_000);
  }, 180_000);
});

describe('telling the apps about a closed account', () => {
  it('keeps what an app did not take, tries again an hour later, and gives up after a week', async () => {
    arrange();
    h.appAnswer = (c) =>
      new Response(null, { status: c.url.includes('/api/internal/people/') ? 503 : 200 });
    await purge({ personId: ADA, teamIds: ['D'] });
    await settle();
    const waiting = count('SELECT COUNT(*) AS n FROM person_app_notices');
    expect(waiting).toBeGreaterThan(0);
    const now = Date.now();
    h.appCalls = [];
    await drainPersonNotices(h.db.env, now + 1000);
    expect(h.appCalls.filter((c) => c.url.includes('/people/'))).toHaveLength(0);
    h.appAnswer = () => new Response(null, { status: 200 });
    await drainPersonNotices(h.db.env, now + NOTICE_RETRY_AFTER_MS + 1);
    expect(count('SELECT COUNT(*) AS n FROM person_app_notices')).toBe(0);

    run(
      `INSERT INTO person_app_notices (person_id, app, item_id, created_at) VALUES (?, 'liveplanner', '', 1)`,
      BEA,
    );
    h.appAnswer = () => new Response(null, { status: 503 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await drainPersonNotices(h.db.env, 1 + NOTICE_GIVE_UP_MS + 1);
    expect(count('SELECT COUNT(*) AS n FROM person_app_notices')).toBe(0);
  });
});
