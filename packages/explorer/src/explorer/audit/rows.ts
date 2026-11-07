// What a team's Audit Log row says (liveworkspace/docs/specs/004-index/team-audit-log.md "The Audit Log on a team's
// view"): who did what in one line, the detail that matters beside the kind's label, the Event filter's groups, and
// the From and To days as the read's range.

import {
  isWebhookKind,
  TEAM_AUDIT_ACCOUNT_TYPES,
  TEAM_AUDIT_EVENT_TYPES,
  type TeamAuditEvent,
  type TeamAuditEventType,
  type TeamAuditPerson,
  type WebhookKind,
} from '@liveworkspace/index-client';
import { quoted } from '../../quoted';
import { SHARE_LEVEL_WORDS } from '../../timeline/share-levels';

// The anonymised id a closed account's rows carry.
const ANONYMISED = 'deleted';

/** A person as a row names them: a closed account, or nobody accounts could name, says so. */
export function personWords(person: TeamAuditPerson | null): string {
  if (!person) return 'Someone';
  if (person.id === ANONYMISED) return 'Deleted account';
  return person.name?.trim() || 'Someone';
}

/** One row's line: who (bold), what they did, and the thing it was done to (bold), when there is one. */
export type AuditSentence = { who: string; action: string; target: string | null; after?: string };

export function auditSentence(event: TeamAuditEvent, teamId: string): AuditSentence {
  const who = personWords(event.actor);
  const detail = event.detail ?? {};
  // Whom a team event is about: accounts' name now, else what the event carried.
  const about =
    event.subject?.id === ANONYMISED
      ? 'Deleted account'
      : event.subject?.name?.trim() || detail.memberName?.trim() || 'a member';
  const title = event.title.trim() || 'Untitled';
  const role = detail.role === 'admin' ? 'an Admin' : 'a Member';
  switch (event.type) {
    case 'team_invite_sent':
      return { who, action: 'invited', target: about, after: `as ${role}` };
    case 'team_joined':
      return {
        who,
        action: detail.via === 'link' ? 'joined by the invite link' : 'joined the team',
        target: null,
      };
    case 'team_declined':
      return { who, action: 'declined the invitation', target: null };
    case 'team_role_changed':
      return { who, action: 'made', target: about, after: role };
    case 'team_member_removed':
      return detail.left
        ? { who, action: 'left the team', target: null }
        : { who, action: 'removed', target: about };
    case 'team_renamed':
      return { who, action: 'renamed the team to', target: title };
    case 'shared':
      return {
        who,
        action: detail.public ? 'made a public link on' : 'made a share link on',
        target: title,
      };
    case 'unshared':
      return { who, action: 'removed a share link from', target: title };
    case 'moved':
      return {
        who,
        action: 'moved',
        target: title,
        after: detail.fromTeamId === teamId ? 'out of the team' : 'into the team',
      };
    case 'trashed':
      return { who, action: 'moved', target: title, after: 'to the Trash' };
    case 'restored':
      return { who, action: 'restored', target: title, after: 'from the Trash' };
    case 'deleted':
      return { who, action: 'deleted', target: title, after: 'for good' };
    case 'webhook_added':
      return { who, action: 'added the webhook', target: detail.host ?? title };
    case 'webhook_removed':
      return { who, action: 'removed the webhook', target: detail.host ?? title };
  }
}

const WEBHOOK_KIND_WORDS: Readonly<Record<WebhookKind, string>> = {
  json: 'Signed JSON',
  slack: 'Slack',
  teams: 'Microsoft Teams',
};

/** The detail that matters beside the kind's label, or null when the line says it all. */
export function auditDetail(event: TeamAuditEvent): string | null {
  const detail = event.detail ?? {};
  switch (event.type) {
    case 'shared':
      if (detail.public) return 'Community post';
      return SHARE_LEVEL_WORDS[detail.level ?? ''] ?? null;
    case 'team_renamed':
      return detail.from ? `Was ${quoted(detail.from)}` : null;
    case 'deleted':
      return detail.reason === 'offline' ? 'Taken offline' : null;
    case 'webhook_added':
    case 'webhook_removed':
      return isWebhookKind(detail.kind) ? WEBHOOK_KIND_WORDS[detail.kind] : null;
    default:
      return null;
  }
}

/** The Event filter's groups, in the order the list offers them. */
export const AUDIT_GROUPS: readonly { label: string; kinds: readonly TeamAuditEventType[] }[] = [
  { label: 'People', kinds: TEAM_AUDIT_ACCOUNT_TYPES },
  {
    label: 'Documents',
    kinds: TEAM_AUDIT_EVENT_TYPES.filter(
      (k) =>
        !(TEAM_AUDIT_ACCOUNT_TYPES as readonly string[]).includes(k) && !k.startsWith('webhook_'),
    ),
  },
  { label: 'Webhooks', kinds: ['webhook_added', 'webhook_removed'] },
];

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

// A `YYYY-MM-DD` day's local midnight, or undefined for none (or a day that isn't one).
function midnight(day: string | undefined, plusDays = 0): number | undefined {
  const m = day ? DAY.exec(day) : null;
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + plusDays).getTime();
}

/** From and To as whole days in the reader's time zone, both included: To is sent as the next day's midnight. A From
 *  after To is turned round. */
export function dayRange(from: string | undefined, to: string | undefined) {
  const [first, last] = from && to && from > to ? [to, from] : [from, to];
  return { from: midnight(first), to: midnight(last, 1) };
}

/** "Northwind Ops" → "northwind-ops", for the file's name; "team" when nothing is left. */
export function fileSlug(name: string): string {
  // Each run of anything else becomes one hyphen, none at either end: one pass, no backtracking.
  let slug = '';
  for (const ch of name.normalize('NFKD').toLowerCase()) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) slug += ch;
    else if (slug && !slug.endsWith('-')) slug += '-';
    if (slug.length >= 60) break;
  }
  if (slug.endsWith('-')) slug = slug.slice(0, -1);
  return slug || 'team';
}
