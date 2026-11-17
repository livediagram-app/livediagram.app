import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCatalogue } from '@liveplanner/items';
import { setPlanItemTypes } from '../plan-room/plan-content';
import type {
  CalendarFeedIssueResponse,
  CalendarFeedOptionsResponse,
  CalendarFeedResponse,
} from '@liveplanner/api-schema';
import {
  USER,
  automationWorld,
  type AutomationWorld,
  type Caller,
} from '../plan-room/automations/test-automation-world';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { calendarFeedFor, calendarFeedOf, issueCalendarFeed } from '../calendar/feed-store';
import { feedTokenHash } from '../calendar/feed-token';
import type { PlanEnv } from '../types';

// Who may manage a calendar feed (docs/specs/026-plan/calendar-feed.md "Managing a feed"; share-roles.md): the plan's
// owner or a team member, signed in, in person. Someone who holds the plan through a share link, at any level (Editor,
// Participant, Viewer, a link to one tab), an API token (read-only or not), a workbench session, a guest and a link
// visitor with no account are all refused, on every route, and nothing changes.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await automationWorld('A');
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const planEnv = (): PlanEnv => w.plans.get('A')!.room.requireEnv();
const ALL = { typeIds: null, boardId: null, mine: false, includeDone: false };
const tokenOf = (path: string) => /\/(lpf_[A-Za-z0-9_-]{43})\.ics$/.exec(path)![1]!;

const ALLOWED: Caller[] = ['owner', 'team'];
const REFUSED: Caller[] = [
  'editor_link',
  'tab_editor_link',
  'participant',
  'viewer',
  'token',
  'token_read_only',
  'token_participant',
  'token_tab',
  'workbench',
  'guest',
  'link_visitor',
];

describe('the owner and a team member, signed in', () => {
  it.each(ALLOWED)('%s may read, make, change, reset and turn off their feed', async (who) => {
    await setPlanItemTypes(planEnv(), 'A', defaultCatalogue());
    const first = await w.as(who, 'GET', '/calendar-feed');
    expect(first.status).toBe(200);
    expect(first.headers.get('Cache-Control')).toBe('no-store');
    const empty = await first.json<CalendarFeedResponse>();
    // The plan's card types, each with its glyph and colour, to pick from.
    expect(empty.feed).toBeNull();
    expect(empty.types.length).toBeGreaterThan(0);
    expect(empty.types[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      glyph: expect.any(String),
      color: expect.any(String),
    });
    const typeId = empty.types[0]!.id;

    const made = await w.as(who, 'POST', '/calendar-feed', { typeIds: [typeId] });
    expect(made.status).toBe(201);
    const issued = await made.json<CalendarFeedIssueResponse>();
    expect(issued.path).toMatch(/^\/api\/calendar\/A\/lpf_[A-Za-z0-9_-]{43}\.ics$/);
    expect(issued.feed).toMatchObject({ typeIds: [typeId], mine: false, includeDone: false });
    const token = tokenOf(issued.path);
    expect(await calendarFeedOf(planEnv(), 'A', await feedTokenHash(token))).toMatchObject({
      personId: USER,
      typeIds: [typeId],
    });

    // Options change, the link stays.
    const changed = await w.as(who, 'PUT', '/calendar-feed', {
      typeIds: null,
      mine: true,
      includeDone: true,
    });
    expect(changed.status).toBe(200);
    expect((await changed.json<CalendarFeedOptionsResponse>()).feed).toEqual({
      typeIds: null,
      boardId: null,
      mine: true,
      includeDone: true,
      createdAt: issued.feed.createdAt,
    });
    expect(await calendarFeedOf(planEnv(), 'A', await feedTokenHash(token))).toMatchObject({
      mine: true,
      includeDone: true,
    });
    const read = await (await w.as(who, 'GET', '/calendar-feed')).json<CalendarFeedResponse>();
    expect(read.feed).toMatchObject({ mine: true, includeDone: true });
    expect(JSON.stringify(read)).not.toContain('lpf_');

    // Reset Link: a new link, and the old one stops at once.
    const reset = await w.as(who, 'POST', '/calendar-feed', ALL);
    expect(reset.status).toBe(201);
    const next = tokenOf((await reset.json<CalendarFeedIssueResponse>()).path);
    expect(next).not.toBe(token);
    expect(await calendarFeedOf(planEnv(), 'A', await feedTokenHash(token))).toBeNull();
    expect(await calendarFeedOf(planEnv(), 'A', await feedTokenHash(next))).not.toBeNull();

    // Turn Off, twice: 204 both times, and the feed is gone.
    expect((await w.as(who, 'DELETE', '/calendar-feed')).status).toBe(204);
    expect((await w.as(who, 'DELETE', '/calendar-feed')).status).toBe(204);
    expect(await calendarFeedOf(planEnv(), 'A', await feedTokenHash(next))).toBeNull();
    const after = await (await w.as(who, 'GET', '/calendar-feed')).json<CalendarFeedResponse>();
    expect(after.feed).toBeNull();
  });
});

describe('anyone else', () => {
  const ROUTES: [string, unknown?][] = [
    ['GET'],
    ['POST', ALL],
    ['PUT', { ...ALL, mine: true }],
    ['DELETE'],
  ];
  it.each(REFUSED)('%s is refused on every route, and nothing changes', async (who) => {
    await issueCalendarFeed(planEnv(), 'A', USER, ALL, 5);
    for (const [method, body] of ROUTES) {
      const res = await w.as(who, method, '/calendar-feed', body);
      if (who === 'link_visitor') {
        // No identity at all: the missing-identity answer every plan route gives.
        expect(res.status, method).toBe(400);
        continue;
      }
      expect(res.status, `${who} ${method}`).toBe(403);
      expect(await res.json()).toEqual({ error: 'calendar_feed_needs_member' });
    }
    expect(await calendarFeedFor(planEnv(), 'A', USER)).toEqual({ ...ALL, createdAt: 5 });
  });
});

describe('the options', () => {
  it.each([
    ['a card type the plan lacks', { ...ALL, typeIds: ['gone'] }],
    ['an empty list of types', { ...ALL, typeIds: [] }],
    ['an empty type id', { ...ALL, typeIds: [''] }],
    ['a type id past the limit', { ...ALL, typeIds: ['t'.repeat(201)] }],
    ['a type id that is not a string', { ...ALL, typeIds: [7] }],
    ['a type named twice', { ...ALL, typeIds: ['task', 'task'] }],
    ['types that are not a list', { ...ALL, typeIds: 'task' }],
    [
      'more types than a feed may name',
      { ...ALL, typeIds: Array.from({ length: 51 }, (_, i) => `t${i}`) },
    ],
    ['a flag that is not a boolean', { ...ALL, mine: 'yes' }],
    ['another flag that is not a boolean', { ...ALL, includeDone: 1 }],
  ])('refuses %s', async (_name, body) => {
    const res = await w.as('owner', 'POST', '/calendar-feed', body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'calendar_feed_invalid' });
    expect(await calendarFeedFor(planEnv(), 'A', USER)).toBeNull();
  });

  it('refuses a body that is not an object', async () => {
    expect((await w.as('owner', 'POST', '/calendar-feed', [1])).status).toBe(400);
  });

  it('reads absent flags and absent types as every type, no filters', async () => {
    const res = await w.as('owner', 'POST', '/calendar-feed', {});
    expect(res.status).toBe(201);
    expect((await res.json<CalendarFeedIssueResponse>()).feed).toMatchObject(ALL);
  });

  it('answers 404 to a change with no feed, and makes none', async () => {
    const res = await w.as('owner', 'PUT', '/calendar-feed', ALL);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'calendar_feed_not_found' });
    expect(await calendarFeedFor(planEnv(), 'A', USER)).toBeNull();
  });

  it('refuses a bad body on a change before looking for the feed', async () => {
    const res = await w.as('owner', 'PUT', '/calendar-feed', { ...ALL, mine: 2 });
    expect(res.status).toBe(400);
  });
});

describe('the path', () => {
  it('answers 405 to another method', async () => {
    expect((await w.as('owner', 'PATCH', '/calendar-feed', ALL)).status).toBe(405);
  });

  it('leaves a longer path to the other routes', async () => {
    expect((await w.as('owner', 'GET', '/calendar-feed/x')).status).toBe(404);
  });
});
