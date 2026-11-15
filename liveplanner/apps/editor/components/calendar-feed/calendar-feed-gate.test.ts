import { describe, expect, it } from 'vitest';
import { calendarFeedScopeFor } from './calendar-feed-gate';
import { appleCalendarUrl, feedUrlOf, googleCalendarUrl } from './calendar-feed-links';

// docs/specs/026-plan/calendar-feed.md "Where it lives": the plan's owner or a team member (no share link, no tab),
// signed in, on a plan saved to an account, outside an embed and a workbench frame. Nobody else sees the row.
const OWNER = {
  hydrated: true,
  embed: false,
  workbench: false,
  offline: false,
  signedIn: true,
  scope: { ownerId: 'user_1', projectId: 'p1', shareCode: null, tabId: null },
};

describe('who sees Subscribe to Calendar', () => {
  it('the owner or a team member, signed in, on a plan saved to an account', () => {
    expect(calendarFeedScopeFor(OWNER)).toEqual({ ownerId: 'user_1', projectId: 'p1' });
  });

  it.each([
    ['a share link at any level', { scope: { ...OWNER.scope, shareCode: 'code1' } }],
    ['a link to one tab', { scope: { ...OWNER.scope, tabId: 't1' } }],
    ['a guest', { signedIn: false }],
    ['a plan in This Browser', { offline: true }],
    ['an embed', { embed: true }],
    ['a workbench frame', { workbench: true }],
    ['a plan still opening', { hydrated: false }],
    ['a plan with no items scope', { scope: null }],
  ])('not %s', (_name, change) => {
    expect(calendarFeedScopeFor({ ...OWNER, ...change })).toBeNull();
  });
});

describe('the link', () => {
  const url = 'https://www.liveplanner.app/api/calendar/p1/lpf_abc.ics';

  it("is the api's path on the api's own origin", () => {
    expect(
      feedUrlOf(
        '/api/calendar/p1/lpf_abc.ics',
        'https://www.liveplanner.app/api',
        'https://x.test/',
      ),
    ).toBe(url);
    expect(
      feedUrlOf('/api/calendar/p1/lpf_abc.ics', '/api', 'http://localhost:3200/project/p1'),
    ).toBe('http://localhost:3200/api/calendar/p1/lpf_abc.ics');
  });

  it('subscribes in Apple Calendar through webcal', () => {
    expect(appleCalendarUrl(url)).toBe('webcal://www.liveplanner.app/api/calendar/p1/lpf_abc.ics');
    expect(appleCalendarUrl('http://localhost:8787/api/calendar/p1/x.ics')).toBe(
      'webcal://localhost:8787/api/calendar/p1/x.ics',
    );
  });

  it('subscribes in Google Calendar through its add-by-address page, the webcal link in cid', () => {
    expect(googleCalendarUrl(url)).toBe(
      'https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fwww.liveplanner.app%2Fapi%2Fcalendar%2Fp1%2Flpf_abc.ics',
    );
  });
});
