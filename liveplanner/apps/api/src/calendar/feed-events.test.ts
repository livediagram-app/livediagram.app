// A calendar feed's store and events (docs/specs/026-plan/calendar-feed.md "The feed link", "What it shows"):
// hashed tokens tied to a person, Reset Link and turning a feed off, and the cards each feed shows.
import { describe, expect, it } from 'vitest';
import { DAY_MS, ITEMS_MAX, defaultCatalogue, itemPersonId, type Item } from '@liveplanner/items';
import { cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { writeCalendar } from './ics';
import type { Element } from '@liveplanner/project';
import { insertItems } from '../db/items';
import { upsertTab } from '../db/tabs';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { anonymisePlan } from '../plan-room/plan-anonymise';
import { sqliteD1 } from '../test-sqlite-d1';
import { planNamespace } from '../plan-room/test-plan-namespace';
import type { Env } from '../types';
import { feedEventsOf, FEED_EVENTS_MAX, FEED_SUMMARY_MAX } from './feed-events';
import {
  calendarFeedOf,
  issueCalendarFeed,
  revokeCalendarFeed,
  type CalendarFeed,
} from './feed-store';
import { FEED_TOKEN_PATTERN, feedTokenHash } from './feed-token';

const ADA = 'user_ada';
const PERSON = { id: 'p-ada', name: 'Ada', color: '#123456' };
const NOW = Date.UTC(2026, 10, 15, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const iso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const ALL: CalendarFeed = { personId: ADA, boardId: null, mine: false, includeDone: false };

const board = (id: string, title: string): Element =>
  ({
    id,
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    planBoard: {
      title,
      columns: [
        { id: `${id}-c1`, name: 'To Do', status: `${id}-todo` },
        { id: `${id}-c2`, name: 'Finished', status: `${id}-done`, done: true },
      ],
    },
  }) as Element;

const card = (
  id: string,
  key: number,
  fields: Item['fields'],
  extra: Partial<Item> = {},
): Item => ({
  id,
  type: 'task',
  key,
  rank: `a${key}`,
  fields,
  rev: 2,
  createdAt: 10,
  updatedAt: Date.UTC(2026, 0, 1),
  createdBy: PERSON,
  updatedBy: PERSON,
  ...extra,
});

async function arrange() {
  const db = sqliteD1({ APP_BASE_URL: 'https://plan.test' });
  db.sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('P', '${ADA}', 'Relaunch', 0, 1, 1)`,
  );
  await setPlanItemTypes(db.env, 'P', defaultCatalogue());
  await upsertTab(
    db.env,
    'P',
    {
      id: 't1',
      name: 'Work',
      kind: 'board',
      elements: [board('b1', 'Kanban'), board('b2', 'Bugs')],
    },
    0,
  );
  return db;
}

describe('the feed store', () => {
  it('stores only the hash of a token tied to the person, and finds the feed by it', async () => {
    const { env, sql } = await arrange();
    const token = await issueCalendarFeed(
      env,
      'P',
      ADA,
      { boardId: 'b1', mine: true, includeDone: true },
      NOW,
    );
    expect(token).toMatch(FEED_TOKEN_PATTERN);
    const rows = sql.prepare('SELECT * FROM calendar_feeds').all();
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]).toMatchObject({ person_id: ADA, token_hash: await feedTokenHash(token) });
    expect(await calendarFeedOf(env, 'P', await feedTokenHash(token))).toEqual({
      personId: ADA,
      boardId: 'b1',
      mine: true,
      includeDone: true,
    });
  });

  it('makes a different token every time', async () => {
    const { env } = await arrange();
    const a = await issueCalendarFeed(env, 'P', ADA, ALL, NOW);
    const b = await issueCalendarFeed(env, 'P', 'user_bea', ALL, NOW);
    expect(a).not.toBe(b);
  });

  it('Reset Link: a new token for the same feed, and the old one finds nothing', async () => {
    const { env, sql } = await arrange();
    const old = await issueCalendarFeed(env, 'P', ADA, ALL, NOW);
    const fresh = await issueCalendarFeed(env, 'P', ADA, ALL, NOW + 1);
    expect(await calendarFeedOf(env, 'P', await feedTokenHash(old))).toBeNull();
    expect(await calendarFeedOf(env, 'P', await feedTokenHash(fresh))).not.toBeNull();
    expect(sql.prepare('SELECT COUNT(*) AS n FROM calendar_feeds').get()).toEqual({ n: 1 });
  });

  it('turning a feed off drops it, and says whether there was one', async () => {
    const { env } = await arrange();
    const token = await issueCalendarFeed(env, 'P', ADA, ALL, NOW);
    expect(await revokeCalendarFeed(env, 'P', ADA)).toBe(true);
    expect(await revokeCalendarFeed(env, 'P', ADA)).toBe(false);
    expect(await calendarFeedOf(env, 'P', await feedTokenHash(token))).toBeNull();
  });

  it("a closed account's feed goes with their name", async () => {
    const { env } = await arrange();
    const token = await issueCalendarFeed(env, 'P', ADA, ALL, NOW);
    await issueCalendarFeed(env, 'P', 'user_bea', ALL, NOW);
    await anonymisePlan(env, 'P', ADA);
    expect(await calendarFeedOf(env, 'P', await feedTokenHash(token))).toBeNull();
  });
});

describe('the events', () => {
  it('one all-day event per dated card: Start to Due, Due alone, Start alone; titled, linked and placed', async () => {
    const { env } = await arrange();
    await insertItems(env, 'P', [
      card('span', 1, {
        title: 'Build',
        status: 'b1-todo',
        start: iso(TODAY),
        due: iso(TODAY + 3),
      }),
      card('due', 2, { title: 'Ship', status: 'b1-todo', due: iso(TODAY + 5) }),
      card('start', 3, { title: 'Kick off', status: 'b2-todo', start: iso(TODAY + 1) }),
      card('backwards', 4, { title: '', start: iso(TODAY + 9), due: iso(TODAY + 7) }),
      card('none', 5, { title: 'No date', status: 'b1-todo' }),
      card('timed', 6, { title: 'Timed', due: '2026-11-20T09:00:00Z' }),
    ]);
    const read = await feedEventsOf(env, 'P', ALL, NOW);
    expect(read?.name).toBe('Relaunch');
    expect(read?.truncated).toBe(false);
    expect(read?.events.map((e) => [e.summary, e.startDay - TODAY, e.endDay - TODAY])).toEqual([
      ['#1 Build', 0, 3],
      ['Starts: #3 Kick off', 1, 1],
      ['#2 Ship', 5, 5],
      ['#4 Untitled', 7, 7],
    ]);
    expect(read?.events[0]).toMatchObject({
      uid: 'span.P@liveplanner.app',
      url: 'https://plan.test/project/P#item=span',
      description: 'Kanban · To Do\nhttps://plan.test/project/P#item=span',
      stamp: Date.UTC(2026, 0, 1),
      sequence: 2,
    });
  });

  it('leaves out archived, trashed and done cards, and includes done ones when asked', async () => {
    const { env } = await arrange();
    const due = iso(TODAY);
    await insertItems(env, 'P', [
      card('open', 1, { title: 'Open', status: 'b1-todo', due }),
      card('done', 2, { title: 'Done', status: 'b1-done', due }),
      card('archived', 3, { title: 'Archived', status: 'b1-todo', due, archived: true }),
      card('trash', 4, { title: 'Trash', status: 'trash', due }),
    ]);
    const titles = async (feed: CalendarFeed) =>
      (await feedEventsOf(env, 'P', feed, NOW))?.events.map((e) => e.summary);
    expect(await titles(ALL)).toEqual(['#1 Open']);
    expect(await titles({ ...ALL, includeDone: true })).toEqual(['#1 Open', '#2 Done']);
  });

  it("shows one board's cards, and only the person's cards", async () => {
    const { env } = await arrange();
    const due = iso(TODAY);
    const ada = { id: await itemPersonId(ADA), name: 'Ada', color: '#112233' };
    const bea = { id: await itemPersonId('user_bea'), name: 'Bea', color: '#112233' };
    await insertItems(env, 'P', [
      card('a', 1, { title: 'Mine', status: 'b1-todo', due, assignee: ada }),
      card('b', 2, { title: 'Hers', status: 'b2-todo', due, assignee: bea }),
      card('c', 3, { title: 'Nobody', status: 'b2-todo', due }),
    ]);
    const titles = async (feed: CalendarFeed) =>
      (await feedEventsOf(env, 'P', feed, NOW))?.events.map((e) => e.summary);
    expect(await titles({ ...ALL, boardId: 'b2' })).toEqual(['#2 Hers', '#3 Nobody']);
    expect(await titles({ ...ALL, mine: true })).toEqual(['#1 Mine']);
    expect(await titles({ ...ALL, boardId: 'gone' })).toEqual([]);
  });

  it('cuts a long title', async () => {
    const { env } = await arrange();
    await insertItems(env, 'P', [card('a', 1, { title: 'x'.repeat(500), due: iso(TODAY) })]);
    const [e] = (await feedEventsOf(env, 'P', ALL, NOW))!.events;
    expect([...e!.summary]).toHaveLength(FEED_SUMMARY_MAX);
    expect(e!.summary.endsWith('…')).toBe(true);
  });

  it(`caps a feed at ${FEED_EVENTS_MAX} events, keeping those nearest today, in date order`, async () => {
    const { env } = await arrange();
    // 300 cards long past, 300 near today (half before, half after), 300 far ahead.
    const cards: Item[] = [];
    let key = 1;
    for (let i = 0; i < 300; i++)
      cards.push(card(`old${i}`, key++, { due: iso(TODAY - 1000 - i) }));
    for (let i = 0; i < 300; i++)
      cards.push(card(`near${i}`, key++, { due: iso(TODAY - 150 + i) }));
    for (let i = 0; i < 300; i++) cards.push(card(`far${i}`, key++, { due: iso(TODAY + 400 + i) }));
    for (let i = 0; i < cards.length; i += 50) await insertItems(env, 'P', cards.slice(i, i + 50));
    const read = (await feedEventsOf(env, 'P', ALL, NOW))!;
    expect(read.truncated).toBe(true);
    expect(read.events).toHaveLength(FEED_EVENTS_MAX);
    expect(read.events.filter((e) => e.uid.startsWith('near'))).toHaveLength(300);
    expect(read.events.filter((e) => e.uid.startsWith('old'))).toHaveLength(0);
    const days = read.events.map((e) => e.startDay);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it(`reads and writes a plan at its card cap (${ITEMS_MAX}) within a CPU budget`, async () => {
    const { env } = await arrange();
    const cards: Item[] = [];
    for (let i = 0; i < ITEMS_MAX; i++)
      cards.push(
        card(`c${i}`, i + 1, {
          title: `Card ${i} ${'é'.repeat(40)}`,
          status: 'b1-todo',
          start: iso(TODAY + (i % 90)),
          due: iso(TODAY + (i % 90) + 2),
        }),
      );
    for (let i = 0; i < cards.length; i += 50) await insertItems(env, 'P', cards.slice(i, i + 50));
    let body = '';
    const ms = await cpuMsOfAsync(async () => {
      body = writeCalendar((await feedEventsOf(env, 'P', ALL, NOW))!);
    });
    expect(body.split('BEGIN:VEVENT')).toHaveLength(FEED_EVENTS_MAX + 1);
    expect(new TextEncoder().encode(body).length).toBeLessThan(400_000);
    expect(ms).toBeLessThan(2000);
  });

  it('answers null for a plan with no row', async () => {
    const { env } = await arrange();
    expect(await feedEventsOf(env, 'nope', ALL, NOW)).toBeNull();
  });
});

describe('the plan room', () => {
  it('answers a feed and its calendar through its RPCs, and nothing for an id nothing has written', async () => {
    const { open } = planNamespace(() => ({}) as Env);
    const plan = open('R');
    const hash = await feedTokenHash(`lpf_${'A'.repeat(43)}`);
    expect(await plan.room.calendarFeed('R', { kind: 'feed', tokenHash: hash })).toBeNull();
    expect(await plan.room.calendarFeed('R', { kind: 'events', feed: ALL, now: NOW })).toBeNull();
    expect(plan.room.storedSchema()).toBe(false);
    // A stored plan: its schema made by another RPC, its row and a feed.
    await plan.room.grantImage('R', 'img');
    plan.db
      .prepare(
        "INSERT OR IGNORE INTO plan (id, name, saved_at, created_at) VALUES ('R', 'Room', 1, 1)",
      )
      .run();
    plan.db.prepare("UPDATE plan SET name = 'Room' WHERE id = 'R'").run();
    plan.db
      .prepare(
        `INSERT INTO calendar_feeds (plan_id, person_id, token_hash, board_id, mine, include_done, created_at)
         VALUES ('R', ?, ?, NULL, 0, 1, 1)`,
      )
      .run(ADA, hash);
    const feed = await plan.room.calendarFeed('R', { kind: 'feed', tokenHash: hash });
    expect(feed).toEqual({ ...ALL, includeDone: true });
    expect(
      await plan.room.calendarFeed('R', { kind: 'events', feed: feed as CalendarFeed, now: NOW }),
    ).toEqual({
      name: 'Room',
      truncated: false,
      events: [],
    });
  });
});
