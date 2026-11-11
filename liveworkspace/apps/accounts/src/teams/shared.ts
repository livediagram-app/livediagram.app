// What every part of teams.ts shares: the limits, the row types, and the small helpers each write uses.

import { type SettingsApp, isSettingsApp } from '../settings.ts';
import { cleanText } from '@liveworkspace/api-kit/typed-text';
import { type TeamEventType, type TeamEvent, eventStatement } from '../index-events.ts';

// Longer names are cut to this, like account names.
export const TEAM_NAME_MAX_LENGTH = 80;
// Teams one account can be in: the access token carries them all (teamsClaim), so this bounds it.
export const MAX_TEAMS_PER_ACCOUNT = 50;
// Members and open invitations in one team.
export const MAX_MEMBERS_PER_TEAM = 200;
// The free-text organisation line under a team's name.
export const ORGANISATION_MAX_LENGTH = 80;
// How long a join link works once an admin turns it on (or makes a new one).
export const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// An unanswered invitation is reminded at these ages, then expires (liveworkspace/docs/specs/003-accounts/accounts.md
// "Reminders and expiry").
export const REMINDER_AGES_MS = [1 * DAY_MS, 7 * DAY_MS, 21 * DAY_MS] as const;
export const INVITATION_TTL_MS = 28 * DAY_MS;
// Per sweep: invitations expired, and reminders sent per stage.
export const EXPIRE_BATCH = 500;
export const REMINDER_BATCH = 100;
// Failed reminder sends in a row before an invitation leaves the reminder queue for good.
export const MAX_REMINDER_ATTEMPTS = 3;
// Decline tokens kept per invitation: the invitation's own and one per reminder.
export const MAX_DECLINE_HASHES = 4;

export type TeamRole = 'admin' | 'member';
export type MemberStatus = 'invited' | 'joined' | 'declined' | 'removed';

export interface Actor {
  id: string;
  // The account's verified address, lower-cased, or null when it isn't verified.
  email: string | null;
  // The account's name, for the audit log's "by …" (an event with none says "a teammate").
  name?: string | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (status: number, error: string): Result<never> => ({
  ok: false,
  status,
  error,
});

// One team event for the audit log (index-events.ts), queued in the batch that makes its change. `guard`
// holds only when that change was made.
export function teamEvent(
  db: D1Database,
  event: {
    id: string;
    type: TeamEventType;
    teamId: string;
    teamName: string;
    actor: { id: string | null; name?: string | null } | null;
    at: number;
    detail?: Record<string, string | null>;
  },
  guard?: { sql: string; args: unknown[] },
): D1PreparedStatement {
  const teamEventBody: TeamEvent = {
    id: event.id,
    type: event.type,
    actorId: event.actor?.id ?? null,
    actorName: event.actor?.name ?? null,
    title: event.teamName,
    detail: { teamId: event.teamId, ...event.detail },
    at: event.at,
  };
  return eventStatement(db, teamEventBody, guard);
}

// The member row still in `status`, changed at `now` by the batch before it.
export const memberGuard = (memberId: string, status: MemberStatus, now: number) => ({
  sql: 'EXISTS (SELECT 1 FROM team_member WHERE id = ? AND status = ? AND updatedAt = ?)',
  args: [memberId, status, now],
});

// A unique index refusing a row (two invitations or joins at once): the one race a team write answers as done. Any
// other failure (D1 down, a foreign key) is no answer at all and goes on to the request-failure guard.
export const isUniqueClash = (err: unknown) => /UNIQUE constraint failed/i.test(String(err));

// The app an invitation's sender signed up through (migrations/0009_signup_app.sql), one primary-key
// read beside the member row: its emails are counted under it (email.ts). Null for liveworkspace.app,
// or an account with no series.
export const INVITER_APP =
  '(SELECT l.signup_app FROM email_lifecycle l WHERE l.user_id = m.invitedBy)';
export const appOrNull = (value: unknown): SettingsApp | null =>
  isSettingsApp(value) ? value : null;

// The rev the statement after it writes: bump first, then read it back, in one batch.
export const BUMP = 'UPDATE team_seq SET value = value + 1 WHERE id = 1';
export const REV = '(SELECT value FROM team_seq WHERE id = 1)';

// An organisation line, or null for none. Anything but a string is treated as none.
export function cleanOrganisation(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return cleanText(value, ORGANISATION_MAX_LENGTH) || null;
}

export function cleanTeamName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = cleanText(value, TEAM_NAME_MAX_LENGTH);
  return name || null;
}

// Control characters (C0, C1) and invisible formatting ones (bidi controls, zero-width spaces and joiners, soft hyphens).
const INVISIBLE = /[\p{Cc}\p{Cf}]/u;

// A plausible address, lower-cased; the invitation email is what proves it.
export function cleanEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  // No control or invisible formatting character (a bidi override, a zero-width space): such an address can't be
  // mailed, and in the members list it would pass for another ("\u202Emoc.elpmaxe@evil.com" reads
  // "moc.live@example.com", "bo\u200Bb@…" as "bob@…").
  if (INVISIBLE.test(email)) return null;
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
