import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { DAY_MONTH_YEAR } from '@liveworkspace/ui/date-format';
import type { TeamMember } from '../../data/teams';
import {
  addedOn,
  invitationLine,
  invitationPill,
  isAddress,
  matchesPerson,
  peopleCounts,
  shownPeople,
  splitAddresses,
  tidyAddress,
} from './people';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 24, 12);

const m = (over: Partial<TeamMember>): TeamMember => ({
  id: 'm',
  userId: 'u',
  email: 'a@x.test',
  name: 'Ann Lee',
  role: 'member',
  status: 'joined',
  ...over,
});

const team: TeamMember[] = [
  m({ id: 'me', name: 'Sam Doe', role: 'admin', email: 'sam@x.test' }),
  m({ id: 'ann', name: 'Ann Lee', email: 'ann@x.test' }),
  m({ id: 'kai', userId: null, name: null, email: 'kai@x.test', status: 'invited' }),
  m({ id: 'old', userId: null, name: null, email: 'old@x.test', status: 'invited', expired: true }),
];
const isSelf = (x: TeamMember) => x.id === 'me';

describe('the People tab', () => {
  it('counts each chip', () => {
    expect(peopleCounts(team)).toEqual({ everyone: 4, admins: 1, members: 1, pending: 2 });
  });

  it('leaves the rows each chip and search asks for', () => {
    const ids = (r: { joined: TeamMember[]; waiting: TeamMember[] }) => [
      r.joined.map((x) => x.id),
      r.waiting.map((x) => x.id),
    ];
    expect(ids(shownPeople(team, 'everyone', '', isSelf))).toEqual([
      ['me', 'ann'],
      ['kai', 'old'],
    ]);
    expect(ids(shownPeople(team, 'admins', '', isSelf))).toEqual([['me'], []]);
    expect(ids(shownPeople(team, 'members', '', isSelf))).toEqual([['ann'], []]);
    expect(ids(shownPeople(team, 'pending', '', isSelf))).toEqual([[], ['kai', 'old']]);
    expect(ids(shownPeople(team, 'everyone', ' KAI ', isSelf))).toEqual([[], ['kai']]);
  });

  it('finds a person by name or address', () => {
    expect(matchesPerson(team[1]!, 'lee', false)).toBe(true);
    expect(matchesPerson(team[1]!, 'ann@', false)).toBe(true);
    expect(matchesPerson(team[1]!, 'zed', false)).toBe(false);
    expect(matchesPerson(team[1]!, '  ', false)).toBe(true);
  });

  // Dates are in the viewer's own locale (DAY_MONTH_YEAR), so the expected words come from the same formatter.
  it('dates when someone was added, and nothing without a date', () => {
    const at = Date.UTC(2026, 2, 2, 12);
    expect(addedOn({ createdAt: at })).toBe(DAY_MONTH_YEAR.format(at));
    expect(addedOn({})).toBeNull();
  });

  it('words an invitation: role, who sent it, and when it ends', () => {
    const sent = NOW - 23 * DAY;
    expect(
      invitationLine(m({ status: 'invited', invitedByName: 'Maya Fox', sentAt: sent }), NOW),
    ).toBe('Member · invited by Maya · ends in 5 days');
    expect(
      invitationLine(m({ status: 'invited', role: 'admin', sentAt: NOW - 27.5 * DAY }), NOW),
    ).toBe('Admin · ends today');
    expect(invitationLine(m({ status: 'invited', sentAt: NOW - 30 * DAY }), NOW)).toBe(
      `Member · ended ${DAY_MONTH_YEAR.format(NOW - 2 * DAY)}`,
    );
    expect(invitationLine(m({ status: 'invited', expired: true }), NOW)).toBe('Member · ended');
    expect(invitationLine(m({ status: 'declined' }), NOW)).toBe('Member');
    expect(invitationLine(m({ status: 'invited' }), NOW)).toBe('Member');
  });

  it('pills an invitation by its state', () => {
    expect(invitationPill(m({ status: 'invited' }))).toBe('Invited');
    expect(invitationPill(m({ status: 'invited', expired: true }))).toBe('Expired');
    expect(invitationPill(m({ status: 'declined' }))).toBe('Declined');
  });
});

describe('Invite by Email’s addresses', () => {
  it('splits what was pasted, keeps each once, and takes the address from a named one', () => {
    expect(
      splitAddresses('Zoe Ray <Zoe@X.test>, amy@x.test;\nbo@x.test  amy@x.test\tnope'),
    ).toEqual(['zoe@x.test', 'amy@x.test', 'bo@x.test', 'nope']);
    expect(splitAddresses('  ')).toEqual([]);
  });

  it('tidies and checks one address', () => {
    expect(tidyAddress('  Ann <ANN@x.test> ')).toBe('ann@x.test');
    expect(isAddress('ann@x.test')).toBe(true);
    expect(isAddress('ann@x')).toBe(false);
    expect(isAddress('a b@x.test')).toBe(false);
    expect(isAddress(`${'a'.repeat(250)}@x.test`)).toBe(false);
  });

  it('splits a very long paste quickly', () => {
    const text = Array.from({ length: 5000 }, (_, i) => `p${i}@x.test`).join(', ');
    let split: string[] = [];
    const spent = cpuMsOf(() => (split = splitAddresses(text)));
    expect(split).toHaveLength(5000);
    expect(spent).toBeLessThan(cpuBudgetMs(500));
  });
});
