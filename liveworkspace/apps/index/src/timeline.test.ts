// The Timeline: the index records its own events in the change's batch, apps report edits, a person sees what
// happened in their own space and their teams', one app's or every app's, a page at a time, in one statement
// that reads one index range per scope.
import { APP_EVENTS_MAX, type TimelineEvent, type TimelinePage } from '@liveworkspace/index-client';
import type { SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Person } from './auth';
import { buildTimelineQuery } from './timeline';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const DAY = 86_400_000;
const TODAY = 20_400;

const feed = async (auth: string, query = '') =>
  body<TimelinePage>(await call(`/timeline${query ? `?${query}` : ''}`, { auth }));
const kinds = (events: TimelineEvent[]) => events.map((e) => `${e.type} ${e.title}`);
const asApp = (path: string, payload: unknown, app = 'liveplanner', key = 'lp-key') =>
  call(path, { method: 'PUT', auth: key, headers: { 'X-Index-App': app }, body: payload });

afterEach(() => vi.useRealTimers());

// Each call a millisecond on, so the order is the order things were done in.
function tick() {
  let now = TODAY * DAY;
  vi.useFakeTimers({ toFake: ['Date'], now });
  return () => vi.setSystemTime((now += 1000));
}

describe('what the index records', () => {
  it('records create, rename, move, trash, restore, share, unshare and favourite, newest first', async () => {
    const next = tick();
    const ada = await person('user_tl1');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    next();
    const folder = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'Launch' } }),
    );
    const patch = (input: Record<string, unknown>) =>
      call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: input });
    await patch({ title: 'Roadmap 2' });
    next();
    await patch({ folderId: folder.folder.id });
    next();
    // Saying what it is already says nothing.
    await patch({ title: 'Roadmap 2', folderId: folder.folder.id });
    next();
    await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'view' },
    });
    next();
    await call(`/items/${item.id}/share`, { method: 'DELETE', auth: ada.auth });
    next();
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: ada.auth });
    next();
    // Starring it again is not news.
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: ada.auth });
    next();
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    next();
    await call(`/items/${item.id}/restore`, { method: 'POST', auth: ada.auth });
    next();
    // An empty item tidied away by its app is not news.
    const empty = await makeItem(ada.auth, { title: 'Blank' });
    next();
    await call(`/items/${empty.id}?reason=empty`, { method: 'DELETE', auth: ada.auth });

    const page = await feed(ada.auth);
    expect(kinds(page.events)).toEqual([
      'created Blank',
      'restored Roadmap 2',
      'trashed Roadmap 2',
      'favourited Roadmap 2',
      'unshared Roadmap 2',
      'shared Roadmap 2',
      'moved Roadmap 2',
      'renamed Roadmap 2',
      'created Roadmap',
    ]);
    const byType = new Map(page.events.map((e) => [e.type, e]));
    expect(byType.get('renamed')!.detail).toEqual({ from: 'Roadmap' });
    expect(byType.get('moved')!.detail).toEqual({ folderName: 'Launch', teamId: null });
    expect(byType.get('shared')!.detail).toEqual({ level: 'view' });
    expect(page.events.every((e) => e.actorId === 'user_tl1' && e.actorName === null)).toBe(true);
    // The item as it is now rides along: its name since, its place, its access.
    expect(page.events[0]!.item).toMatchObject({ title: 'Blank', trashedAt: expect.any(Number) });
    expect(page.events.at(-1)!.item).toMatchObject({ title: 'Roadmap 2', access: 'edit' });
    expect(page.seenAt).toBeNull();
  });

  it('records a copy and where an AI or import made it', async () => {
    const ada = await person('user_tl2');
    const made = await makeItem(ada.auth, { title: 'Drafted', source: 'ai' });
    let events = (await feed(ada.auth)).events;
    expect(events[0]).toMatchObject({ type: 'created', detail: { source: 'ai' }, itemId: made.id });
    const copy = await call(`/items/${made.id}/copy`, { method: 'POST', auth: ada.auth, body: {} });
    expect(copy.status).toBe(201);
    events = (await feed(ada.auth)).events;
    expect(events[0]).toMatchObject({
      type: 'created',
      title: 'Drafted (copy)',
      detail: { copiedFrom: 'Drafted' },
    });
  });

  it("doesn't record a favourite of an item the person can't reach", async () => {
    const ada = await person('user_tl3');
    const bea = await person('user_tl3b');
    const theirs = await makeItem(bea.auth, { title: 'Private' });
    await call(`/favourites/${theirs.id}`, { method: 'PUT', auth: ada.auth });
    expect((await feed(ada.auth)).events).toEqual([]);
  });
});

describe('Remove from Timeline and the new count', () => {
  const inbox = async (auth: string, query = '') =>
    body<{ timelineNew: number }>(await call(`/inbox${query ? `?${query}` : ''}`, { auth }));

  it("takes events off one person's Timeline only, and counts what others did since the last look", async () => {
    const next = tick();
    const ada = await person('user_tlr1', { teams: [{ id: 'team_tlr' }] });
    const cy = await person('user_tlr1c', { teams: [{ id: 'team_tlr' }] });
    const a = await makeItem(ada.auth, { title: 'A', teamId: 'team_tlr' });
    next();
    // Never looked: nothing is new.
    expect((await inbox(cy.auth)).timelineNew).toBe(0);
    await call('/timeline/seen', { method: 'POST', auth: cy.auth });
    next();
    await makeItem(ada.auth, { title: 'B', teamId: 'team_tlr' });
    next();
    await makeItem(ada.auth, { title: 'C', teamId: 'team_tlr', app: 'livediagram' });
    next();
    // Cy's own doing is never new to Cy.
    await makeItem(cy.auth, { title: 'D', teamId: 'team_tlr' });
    next();
    expect((await inbox(cy.auth)).timelineNew).toBe(2);
    expect((await inbox(cy.auth, 'app=liveplanner')).timelineNew).toBe(1);

    const events = (await feed(cy.auth)).events;
    const b = events.find((e) => e.title === 'B')!;
    const res = await call('/timeline/dismiss', {
      method: 'POST',
      auth: cy.auth,
      body: { ids: [b.id, 'no-such-event'] },
    });
    expect(res.status).toBe(204);
    expect(kinds((await feed(cy.auth)).events)).toEqual(['created D', 'created C', 'created A']);
    expect((await inbox(cy.auth)).timelineNew).toBe(1);
    // Still on Ada's.
    expect(kinds((await feed(ada.auth)).events)).toContain('created B');
    expect(a.id).toBeTruthy();
    for (const bad of [{}, { ids: [] }, { ids: [1] }, { ids: Array(101).fill('x') }]) {
      const r = await call('/timeline/dismiss', { method: 'POST', auth: cy.auth, body: bad });
      expect(r.status).toBe(400);
    }
  });

  it('stops counting at 100', async () => {
    const next = tick();
    const ada = await person('user_tlr2', { teams: [{ id: 'team_tlr2' }] });
    const cy = await person('user_tlr2c', { teams: [{ id: 'team_tlr2' }] });
    await call('/timeline/seen', { method: 'POST', auth: cy.auth });
    next();
    for (let i = 0; i < 105; i++) await makeItem(ada.auth, { title: `P${i}`, teamId: 'team_tlr2' });
    next();
    expect((await inbox(cy.auth)).timelineNew).toBe(100);
  });
});

describe('who sees what', () => {
  it("shows a person their own space and their teams', and an item's history follows it", async () => {
    const next = tick();
    const ada = await person('user_tl4', { teams: [{ id: 'team_tl' }] });
    const cy = await person('user_tl4c', { teams: [{ id: 'team_tl' }] });
    const bea = await person('user_tl4b');
    const mine = await makeItem(ada.auth, { title: 'Mine' });
    next();
    const team = await makeItem(ada.auth, { title: 'Team plan', teamId: 'team_tl' });
    next();
    await call(`/favourites/${team.id}`, { method: 'PUT', auth: ada.auth });
    next();

    expect(kinds((await feed(cy.auth)).events)).toEqual(['created Team plan']);
    expect((await feed(bea.auth)).events).toEqual([]);

    // Into the team: its history goes with it, so the team sees how it began.
    await call(`/items/${mine.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { teamId: 'team_tl' },
    });
    expect(kinds((await feed(cy.auth)).events)).toEqual([
      'moved Mine',
      'created Team plan',
      'created Mine',
    ]);
    next();
    // And out again: it leaves the team's Timeline, its move included.
    await call(`/items/${mine.id}`, { method: 'PATCH', auth: ada.auth, body: { teamId: null } });
    expect(kinds((await feed(cy.auth)).events)).toEqual(['created Team plan']);
    expect(kinds((await feed(ada.auth)).events)).toEqual([
      'moved Mine',
      'moved Mine',
      'favourited Team plan',
      'created Team plan',
      'created Mine',
    ]);
    // A newcomer to the team sees what happened before they joined.
    const dee = await person('user_tl4d', { teams: [{ id: 'team_tl' }] });
    expect(kinds((await feed(dee.auth)).events)).toEqual(['created Team plan']);
  });

  it('filters to one app, or shows every app when none is named', async () => {
    const next = tick();
    const ada = await person('user_tl5');
    await makeItem(ada.auth, { title: 'Plan' });
    next();
    await makeItem(ada.auth, { title: 'Canvas', app: 'livediagram' });
    expect(kinds((await feed(ada.auth)).events)).toEqual(['created Canvas', 'created Plan']);
    expect(kinds((await feed(ada.auth, 'app=liveplanner')).events)).toEqual(['created Plan']);
    const canvas = (await feed(ada.auth, 'app=livediagram')).events;
    expect(canvas.map((e) => [e.app, e.item.app])).toEqual([['livediagram', 'livediagram']]);
    expect((await call('/timeline?app=nope', { auth: ada.auth })).status).toBe(400);
    expect((await call('/timeline?limit=0', { auth: ada.auth })).status).toBe(400);
    expect((await call('/timeline?cursor=junk!', { auth: ada.auth })).status).toBe(400);
    expect((await call('/timeline')).status).toBe(401);
  });

  it('pages by cursor without repeats, and remembers when it was seen', async () => {
    const next = tick();
    const ada = await person('user_tl6', { teams: [{ id: 'team_tl6' }] });
    for (let i = 0; i < 5; i++) {
      await makeItem(ada.auth, { title: `P${i}`, ...(i % 2 ? { teamId: 'team_tl6' } : {}) });
      next();
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: TimelinePage = await feed(
        ada.auth,
        `limit=2${cursor ? `&cursor=${cursor}` : ''}`,
      );
      expect(page.events.length).toBeLessThanOrEqual(2);
      seen.push(...page.events.map((e) => e.title));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(['P4', 'P3', 'P2', 'P1', 'P0']);

    const marked = await body<{ seenAt: number }>(
      await call('/timeline/seen', { method: 'POST', auth: ada.auth }),
    );
    expect((await feed(ada.auth)).seenAt).toBe(marked.seenAt);
  });
});

describe('what apps report', () => {
  it("lands a person's edits on one event a day, and counts the day towards their Most Used", async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: TODAY * DAY + 5000 });
    const ada = await person('user_tl7', { teams: [{ id: 'team_tl7' }] });
    const item = await makeItem(ada.auth, { title: 'Shared plan', teamId: 'team_tl7' });
    const edited = (at: number, actorName?: string) => ({
      type: 'edited',
      actorId: 'user_tl7c',
      actorName,
      at,
    });
    expect(
      (
        await asApp(`/app/items/${item.id}/events`, {
          events: [edited(TODAY * DAY + 1000, 'Cy'), edited(TODAY * DAY + 3000)],
        })
      ).status,
    ).toBe(204);
    expect(
      (await asApp(`/app/items/${item.id}/events`, { events: [edited(TODAY * DAY + 4000)] }))
        .status,
    ).toBe(204);
    // The next day is another.
    vi.setSystemTime((TODAY + 1) * DAY + 5000);
    expect(
      (await asApp(`/app/items/${item.id}/events`, { events: [edited((TODAY + 1) * DAY)] })).status,
    ).toBe(204);

    const events = (
      await feed((await person('user_tl7', { teams: [{ id: 'team_tl7' }] })).auth)
    ).events.filter((e) => e.type === 'edited');
    expect(events.map((e) => [e.actorId, e.actorName, e.occurredAt])).toEqual([
      ['user_tl7c', null, (TODAY + 1) * DAY],
      ['user_tl7c', 'Cy', TODAY * DAY + 4000],
    ]);
    const days = h.db.sql
      .prepare('SELECT day FROM use_days WHERE person_id = ? AND item_id = ? ORDER BY day')
      .all('user_tl7c', item.id) as { day: number }[];
    expect(days.map((d) => d.day)).toEqual([TODAY, TODAY + 1]);
    // Cy's Most Used counts both.
    const cyNow = await person('user_tl7c', { teams: [{ id: 'team_tl7' }] });
    const recent = await body<{ mostUsed: { id: string; useDays: number }[] }>(
      await call('/items?view=recent&used=2', { auth: cyNow.auth }),
    );
    expect(recent.mostUsed.map((i) => [i.id, i.useDays])).toEqual([[item.id, 2]]);
  });

  it('refuses a bad report, and another app’s', async () => {
    const ada = await person('user_tl8');
    const item = await makeItem(ada.auth);
    const ok = { type: 'edited', actorId: 'user_tl8', at: 1 };
    const path = `/app/items/${item.id}/events`;
    for (const events of [
      [{ ...ok, type: 'created' }],
      [{ ...ok, actorId: '' }],
      [{ ...ok, at: -1 }],
      [{ ...ok, actorName: 7 }],
      Array.from({ length: APP_EVENTS_MAX + 1 }, () => ok),
      'nope',
    ]) {
      expect((await asApp(path, { events })).status).toBe(400);
    }
    expect((await asApp(path, { events: [ok] }, 'livediagram', 'ld-key')).status).toBe(403);
    expect((await asApp('/app/items/missing/events', { events: [ok] })).status).toBe(404);
  });
});

describe('the bound', () => {
  const ada: Person = { id: 'user_big', kind: 'account', teams: ['team_a', 'team_b'] };

  it('reads each scope through its own index range and never scans the events', () => {
    for (const spec of [
      { limit: 30, app: 'liveplanner' as const },
      { limit: 30 },
      { limit: 30, cursor: { at: 5, id: 'x' } },
    ]) {
      const { sql, args } = buildTimelineQuery(ada, spec);
      const lines = h.db.sql
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...(args as SQLInputValue[]))
        .map((r) => String((r as { detail: string }).detail));
      const plan = lines.join('\n');
      expect(plan).toMatch(spec.app ? /timeline_scopes_app/ : /timeline_scopes_all/);
      expect(
        lines.filter((l) =>
          /\bSCAN (e|i|items|timeline_events|timeline_event_scopes)\b(?! USING)/.test(l),
        ),
        plan,
      ).toEqual([]);
    }
  });

  it('answers a page within budget from 10,000 events of their own among 100,000 others', async () => {
    const db = h.db.sql;
    const item = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, ?, 'plan', ?, NULL, ?, NULL, ?, '{}', 1, 1)`,
    );
    const event = db.prepare(
      `INSERT INTO timeline_events (id, app, item_id, actor_id, type, title, occurred_at)
       VALUES (?, ?, ?, ?, 'edited', ?, ?)`,
    );
    const scope = db.prepare(
      'INSERT INTO timeline_event_scopes (scope, event_id, app, occurred_at) VALUES (?, ?, ?, ?)',
    );
    db.exec('BEGIN');
    for (let i = 0; i < 110_000; i++) {
      const owner = i < 10_000 ? 'user_big' : `user_o${i % 100}`;
      const app = i % 3 === 0 ? 'livediagram' : 'liveplanner';
      const id = `tl-${i}`;
      if (i % 10 === 0) item.run(`it-${i}`, app, owner, `p:${owner}`, `Item ${i}`);
      const itemId = `it-${i - (i % 10)}`;
      const itemApp = (i - (i % 10)) % 3 === 0 ? 'livediagram' : 'liveplanner';
      event.run(id, itemApp, itemId, owner, `Item ${i}`, i);
      scope.run(`p:${owner}`, id, itemApp, i);
    }
    db.exec('COMMIT');
    const big = await person('user_big', { teams: [{ id: 'team_a' }, { id: 'team_b' }] });
    for (const query of ['', 'app=liveplanner']) {
      const started = performance.now();
      const first = await feed(big.auth, query);
      const second = await feed(big.auth, `${query}&cursor=${first.nextCursor}`);
      const ms = performance.now() - started;
      expect(first.events).toHaveLength(30);
      expect(second.events[0]!.occurredAt).toBeLessThan(first.events.at(-1)!.occurredAt);
      console.info(
        `[timeline] 10,000 own events, two pages (${query || 'all apps'}) in ${ms.toFixed(1)} ms`,
      );
      expect(ms).toBeLessThan(250);
    }
    // The sidebar's count, with every one of them new and someone else's: it stops at 100 rows a scope.
    db.exec(`UPDATE timeline_events SET actor_id = 'user_x' WHERE actor_id = 'user_big'`);
    db.exec(`INSERT INTO timeline_scope_state (person_id, last_seen_at) VALUES ('user_big', 0)`);
    let started = performance.now();
    const counted = await body<{ timelineNew: number }>(await call('/inbox', { auth: big.auth }));
    let ms = performance.now() - started;
    expect(counted.timelineNew).toBe(100);
    console.info(
      `[timeline] new count over 10,000 new events, with the Inbox, in ${ms.toFixed(1)} ms`,
    );
    expect(ms).toBeLessThan(250);
    // A thousand removed at the top of the range: skipped in the index walk.
    db.exec(`INSERT INTO timeline_dismissals (person_id, event_id, created_at)
      SELECT 'user_big', id, 1 FROM timeline_events WHERE actor_id = 'user_x' AND occurred_at >= 9000`);
    started = performance.now();
    const after = await feed(big.auth);
    ms = performance.now() - started;
    expect(after.events[0]!.occurredAt).toBeLessThan(9000);
    console.info(`[timeline] a page past 1,000 removed events in ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(250);
  });
});

describe('one item’s history', () => {
  it('lists only that item’s events the person can see, a page at a time', async () => {
    const next = tick();
    const ada = await person('user_hist1');
    const bob = await person('user_hist2');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    const other = await makeItem(ada.auth, { title: 'Other' });
    next();
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'Roadmap 2' } });
    next();
    await call(`/items/${other.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'Other 2' } });
    next();
    await call(`/items/${item.id}/share`, { method: 'POST', auth: ada.auth, body: { level: 'view' } });
    const page = await feed(ada.auth, `item=${item.id}`);
    expect(kinds(page.events)).toEqual(['shared Roadmap 2', 'renamed Roadmap 2', 'created Roadmap']);
    expect(page.events.every((e) => e.itemId === item.id)).toBe(true);
    const first = await feed(ada.auth, `item=${item.id}&limit=2`);
    const rest = await feed(ada.auth, `item=${item.id}&limit=2&cursor=${first.nextCursor}`);
    expect(kinds([...first.events, ...rest.events])).toEqual(kinds(page.events));
    expect(rest.nextCursor).toBeNull();
    // Someone else, outside the item's scope, sees none of it.
    expect((await feed(bob.auth, `item=${item.id}`)).events).toEqual([]);
    expect((await call('/timeline?item=', { auth: ada.auth })).status).toBe(400);
  });

  it('reads through the events’ item index, never scanning', () => {
    const ada: Person = { id: 'user_big', kind: 'account', teams: ['team_a', 'team_b'] };
    for (const spec of [{ limit: 30, item: 'it-1' }, { limit: 30, item: 'it-1', cursor: { at: 5, id: 'x' } }]) {
      const { sql, args } = buildTimelineQuery(ada, spec);
      const lines = h.db.sql
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...(args as SQLInputValue[]))
        .map((r) => String((r as { detail: string }).detail));
      const plan = lines.join('\n');
      expect(plan).toMatch(/timeline_events_item/);
      expect(
        lines.filter((l) =>
          /\bSCAN (e|i|items|timeline_events|timeline_event_scopes|sc)\b(?! USING)/.test(l),
        ),
        plan,
      ).toEqual([]);
    }
  });
});
