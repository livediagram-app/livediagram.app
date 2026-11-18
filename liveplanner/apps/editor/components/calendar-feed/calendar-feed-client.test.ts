import { afterEach, describe, expect, it, vi } from 'vitest';

// docs/specs/026-plan/calendar-feed.md "Managing a feed": the four calls on the person's own feed, never through a
// share link, each answered or refused as the api says.
const core = vi.hoisted(() => ({
  API_BASE: 'https://api.test/api',
  apiFetch: vi.fn<(url: string, init: RequestInit) => Promise<Response>>(),
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
}));
vi.mock('@/lib/api/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/core')>()),
  ...core,
}));

import {
  changeCalendarFeed,
  issueCalendarFeed,
  issueMyWorkCalendarFeed,
  readCalendarFeed,
  readMyWorkCalendarFeed,
  turnOffCalendarFeed,
  turnOffMyWorkCalendarFeed,
} from './calendar-feed-client';

const SCOPE = { ownerId: 'user_1', projectId: 'p 1' };
const OPTIONS = { typeIds: ['bug'], mine: true, includeDone: false };
const URL = 'https://api.test/api/projects/p%201/calendar-feed';

afterEach(() => vi.clearAllMocks());

describe('the calendar feed client', () => {
  it('reads the feed with no share code and no body', async () => {
    core.apiFetch.mockResolvedValue(Response.json({ feed: null, boards: [] }));
    expect(await readCalendarFeed(SCOPE)).toEqual({ feed: null, boards: [] });
    expect(core.apiFetch).toHaveBeenCalledWith(URL, {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(core.apiHeaders).toHaveBeenCalledWith('user_1', { share: null, body: false });
  });

  it('makes, changes and turns off, sending the options as JSON', async () => {
    core.apiFetch.mockResolvedValueOnce(
      Response.json({ feed: {}, path: '/x.ics' }, { status: 201 }),
    );
    expect(await issueCalendarFeed(SCOPE, OPTIONS)).toEqual({ feed: {}, path: '/x.ics' });
    expect(core.apiFetch).toHaveBeenLastCalledWith(URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
      body: JSON.stringify(OPTIONS),
    });
    expect(core.apiHeaders).toHaveBeenLastCalledWith('user_1', { share: null, body: true });
    core.apiFetch.mockResolvedValueOnce(Response.json({ feed: { mine: true } }));
    expect(await changeCalendarFeed(SCOPE, OPTIONS)).toEqual({ feed: { mine: true } });
    expect(core.apiFetch.mock.lastCall![1].method).toBe('PUT');
    core.apiFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(turnOffCalendarFeed(SCOPE)).resolves.toBeUndefined();
    expect(core.apiFetch.mock.lastCall![1].method).toBe('DELETE');
  });

  it('throws on a refusal', async () => {
    core.apiFetch.mockResolvedValue(
      Response.json({ error: 'calendar_feed_needs_member' }, { status: 403 }),
    );
    await expect(readCalendarFeed(SCOPE)).rejects.toThrow();
  });
});

describe('the My Work feed client', () => {
  it('reads, makes and turns off the person’s own feed at /my-work/calendar-feed', async () => {
    const MINE = 'https://api.test/api/my-work/calendar-feed';
    core.apiFetch
      .mockResolvedValueOnce(Response.json({ feed: null }))
      .mockResolvedValueOnce(
        Response.json(
          { feed: { createdAt: 1 }, path: '/api/calendar/my-work/x.ics' },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await readMyWorkCalendarFeed('user_1')).toEqual({ feed: null });
    expect((await issueMyWorkCalendarFeed('user_1')).path).toBe('/api/calendar/my-work/x.ics');
    await turnOffMyWorkCalendarFeed('user_1');
    expect(core.apiFetch.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      [MINE, 'GET'],
      [MINE, 'POST'],
      [MINE, 'DELETE'],
    ]);
    expect(core.apiHeaders).toHaveBeenCalledWith('user_1', { share: null, body: false });
  });
});
