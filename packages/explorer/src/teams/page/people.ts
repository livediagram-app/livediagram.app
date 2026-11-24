// The People tab's sums and words (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): who is
// counted under each filter chip, who a search finds, how an invitation describes itself, and the addresses an
// admin typed or pasted into Invite by Email. Pure, so each is tested on its own.

import { DAY_MONTH_YEAR } from '@liveworkspace/ui/date-format';
import type { TeamMember } from '../../data/teams';
import { memberName, memberState, orderMembers } from '../rules';

/** An invitation closes on its own this long after it was sent (accounts.md "Reminders and expiry"). */
export const INVITATION_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

export const PEOPLE_FILTERS = ['everyone', 'admins', 'members', 'pending'] as const;
export type PeopleFilter = (typeof PEOPLE_FILTERS)[number];

export const PEOPLE_FILTER_LABELS: Record<PeopleFilter, string> = {
  everyone: 'Everyone',
  admins: 'Admins',
  members: 'Members',
  pending: 'Pending',
};

const joined = (m: TeamMember) => m.status === 'joined';

/** How many each chip shows: Everyone is every row on the list, Pending every invitation not yet joined. */
export function peopleCounts(members: readonly TeamMember[]): Record<PeopleFilter, number> {
  let admins = 0;
  let plain = 0;
  let pending = 0;
  for (const m of members) {
    if (!joined(m)) pending++;
    else if (m.role === 'admin') admins++;
    else plain++;
  }
  return { everyone: members.length, admins, members: plain, pending };
}

/** Whether a row answers what was typed in Find a Person: its name or its address, any case. */
export function matchesPerson(m: TeamMember, query: string, self: boolean): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return memberName(m, self).toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q);
}

/** The rows a chip and a search leave: the joined members, then the invitations waiting to join, each in the
 *  card's order. */
export function shownPeople(
  members: readonly TeamMember[],
  filter: PeopleFilter,
  query: string,
  isSelf: (m: TeamMember) => boolean,
): { joined: TeamMember[]; waiting: TeamMember[] } {
  const ordered = orderMembers(members).filter((m) => matchesPerson(m, query, isSelf(m)));
  const people = ordered.filter(joined);
  const waiting = ordered.filter((m) => !joined(m));
  switch (filter) {
    case 'everyone':
      return { joined: people, waiting };
    case 'admins':
      return { joined: people.filter((m) => m.role === 'admin'), waiting: [] };
    case 'members':
      return { joined: people.filter((m) => m.role !== 'admin'), waiting: [] };
    case 'pending':
      return { joined: [], waiting };
  }
}

/** When someone was added to the team ("2 Mar 2026"): the day their row was made (invited, or the team made). */
export function addedOn(m: Pick<TeamMember, 'createdAt'>): string | null {
  return m.createdAt ? DAY_MONTH_YEAR.format(m.createdAt) : null;
}

/** An invitation's line under its address: "Member · invited by Maya · ends in 5 days". */
export function invitationLine(m: TeamMember, now = Date.now()): string {
  const parts: string[] = [m.role === 'admin' ? 'Admin' : 'Member'];
  const by = m.invitedByName?.trim().split(/\s+/)[0];
  if (by) parts.push(`invited by ${by}`);
  const state = memberState(m);
  // A declined one's pill says so already, so its line ends at who sent it.
  if (state === 'declined') return parts.join(' · ');
  if (m.sentAt) {
    const ends = m.sentAt + INVITATION_DAYS * DAY_MS;
    if (state === 'expired' || ends <= now) parts.push(`ended ${DAY_MONTH_YEAR.format(ends)}`);
    else parts.push(endsIn(ends - now));
  } else if (state === 'expired') {
    parts.push('ended');
  }
  return parts.join(' · ');
}

function endsIn(ms: number): string {
  const days = Math.ceil(ms / DAY_MS);
  if (days <= 1) return 'ends today';
  return `ends in ${days} days`;
}

/** An invitation's pill: Invited, Declined or Expired. */
export function invitationPill(m: TeamMember): 'Invited' | 'Declined' | 'Expired' {
  const state = memberState(m);
  return state === 'declined' ? 'Declined' : state === 'expired' ? 'Expired' : 'Invited';
}

// The address shape accounts takes (cleanEmail): something@something.something, no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One typed address, tidied (lower case, trimmed, angle brackets of a pasted "Name <a@b.c>" dropped). */
export function tidyAddress(raw: string): string {
  const inBrackets = /<([^>]+)>/.exec(raw);
  return (inBrackets ? inBrackets[1]! : raw).trim().toLowerCase();
}

export function isAddress(address: string): boolean {
  return address.length <= 254 && EMAIL.test(address);
}

/** The words in what was typed or pasted, split on commas, semicolons, spaces and new lines, each tidied and once.
 *  A pasted "Ann Lee <ann@x.co>" keeps only its address; any other word stays, to be shown as not an address. */
export function splitAddresses(text: string): string[] {
  const out: string[] = [];
  const bracketed = text.replace(/[^,;\n]*<([^>]+)>/g, ' $1 ');
  for (const part of bracketed.split(/[\s,;]+/)) {
    const address = tidyAddress(part);
    if (address && !out.includes(address)) out.push(address);
  }
  return out;
}

/** The most addresses one Send Invite takes: past it, the admin sends the rest in a second go. */
export const MAX_INVITES_AT_ONCE = 50;
