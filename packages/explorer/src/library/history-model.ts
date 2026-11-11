// What an event in an item's History is (livediagram/docs/specs/013-workspace/history.md "The dialog"): the day it
// falls on, its reason line, its tone and its filter chip. No React here, so each rule is tested on its own.

import { isApp, type EventType, type ItemEvent } from '@liveworkspace/index-client';
import { dateFormat, TIME } from '@liveworkspace/ui/date-format';
import { kindWords } from '../words';

// ---------- Days -----------------------------------------------------------------------------------------------

/** The reader's local day. The index keys an edit by UTC day (one row serves everyone); display is local. */
export function dateKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Time of day in the reader's locale. */
export function timeLabel(at: number): string {
  return TIME.format(at);
}

// A day's heading in the reader's locale ("Tue 5 Aug" in the UK, "Tue, Aug 5" in the US), with its year when it
// needs one (@liveworkspace/ui/date-format, one formatter each).
const DAY_LABEL = dateFormat({ weekday: 'short', day: 'numeric', month: 'short' });
const DAY_LABEL_YEAR = dateFormat({
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** A local day's heading, its year, and the heading with the year, in the reader's locale. */
export function formatDay(key: string): { label: string; year: string; withYear: string } {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d);
  if (Number.isNaN(date.getTime())) return { label: key, year: '', withYear: key };
  return { label: DAY_LABEL.format(date), year: String(y), withYear: DAY_LABEL_YEAR.format(date) };
}

// ---------- What an event says ---------------------------------------------------------------------------------

// An item's kind, then this ("Plan Renamed").
const VERBS: Partial<Record<EventType, string>> = {
  created: 'Created',
  edited: 'Updated',
  renamed: 'Renamed',
  moved: 'Moved',
  trashed: 'Moved to Trash',
  restored: 'Restored',
  shared: 'Shared',
  unshared: 'Sharing Stopped',
  favourited: 'Added to Favourites',
};

// The rest say what happened on their own, in livediagram's words.
const LABELS: Partial<Record<EventType, string>> = {
  commented: 'Comment Added',
  comment_resolved: 'Comment Resolved',
  action_assigned: 'Action Assigned',
  action_done: 'Action Completed',
  synced: 'Synced to the Cloud',
  opened_by_visitor: 'Opened by a Visitor',
  copied_by_visitor: 'Copied by a Visitor',
  team_invite_sent: 'Invite Sent',
  team_joined: 'Member Joined',
  team_declined: 'Invite Declined',
  team_role_changed: 'Role Changed',
  team_member_removed: 'Member Removed',
  team_renamed: 'Team Renamed',
};

const isEventType = (type: string): type is EventType => type in TONE_BY_TYPE_KEYS;

/** The reason line, Title Case: the item's kind and what happened ("Plan Renamed", "Canvas Made by AI"), or what
 *  happened alone ("Comment Added"). */
export function eventLabel(event: ItemEvent): string {
  const type = event.type as string;
  if (type === 'team_member_removed' && event.detail?.left) return 'Member Left';
  const own = isEventType(type) ? LABELS[type] : undefined;
  if (own) return own;
  const kind = isApp(event.app) ? kindWords(event.app).one : 'Item';
  if (type === 'created' && event.detail?.source === 'ai') return `${kind} Made by AI`;
  if (type === 'created' && event.detail?.source === 'import') return `${kind} Imported`;
  if (type === 'created' && event.detail?.copiedFrom) return `${kind} Copied`;
  return `${kind} ${(isEventType(type) && VERBS[type]) || 'Changed'}`;
}

// ---------- Tone: what an event's colour means ------------------------------------------------------------------

// Three meanings: something went (danger), the shape of things changed (structural), something was made or
// worked on (create). Anything else is neutral rather than a guess.
export type EventTone = 'danger' | 'structural' | 'create' | 'neutral';

// Exhaustive, so a new event type fails the build until it has a colour (livediagram's tones).
const TONE_BY_TYPE: Record<EventType, EventTone> = {
  trashed: 'danger',
  team_member_removed: 'danger',
  renamed: 'structural',
  moved: 'structural',
  shared: 'structural',
  unshared: 'structural',
  synced: 'structural',
  team_invite_sent: 'structural',
  team_joined: 'structural',
  team_declined: 'structural',
  team_role_changed: 'structural',
  team_renamed: 'structural',
  created: 'create',
  edited: 'create',
  restored: 'create',
  favourited: 'create',
  commented: 'create',
  comment_resolved: 'create',
  action_assigned: 'create',
  action_done: 'create',
  opened_by_visitor: 'create',
  copied_by_visitor: 'create',
};
const TONE_BY_TYPE_KEYS: Record<string, unknown> = TONE_BY_TYPE;

export function eventTone(type: string): EventTone {
  return isEventType(type) ? TONE_BY_TYPE[type] : 'neutral';
}

const TONE_FALLBACK: Record<EventTone, { bold: string; soft: string }> = {
  danger: { bold: '#dc2626', soft: 'rgba(220, 38, 38, 0.10)' },
  structural: { bold: '#b45309', soft: 'rgba(217, 119, 6, 0.10)' },
  create: { bold: '#047857', soft: 'rgba(5, 150, 105, 0.10)' },
  neutral: { bold: '#64748b', soft: 'rgba(100, 116, 139, 0.10)' },
};

// The ink each tone's glyph takes on a dark page: the light page's ink is 3.2 to 3.8:1 on a dark surface, under
// the 4.5:1 a small mark needs, so dark mode lifts each to its 400.
const TONE_DARK_INK: Record<EventTone, string> = {
  danger: '#f87171',
  structural: '#fbbf24',
  create: '#34d399',
  neutral: '#94a3b8',
};

/** Classes for any element drawn in toneColor (or holding one): each tone's ink for the page's mode, as
 *  --lw-event-ink-<tone>. Written out whole so Tailwind finds every one. */
export const TONE_INKS =
  '[--lw-event-ink-danger:#dc2626] [--lw-event-ink-structural:#b45309] [--lw-event-ink-create:#047857] [--lw-event-ink-neutral:#64748b] dark:[--lw-event-ink-danger:#f87171] dark:[--lw-event-ink-structural:#fbbf24] dark:[--lw-event-ink-create:#34d399] dark:[--lw-event-ink-neutral:#94a3b8]';

/** A tone's ink: the mode's from TONE_INKS, else the light page's. */
export const toneColor = (tone: EventTone) =>
  `var(--lw-event-ink-${tone}, ${TONE_FALLBACK[tone].bold})`;

/** A tone's ink on a dark page (what TONE_INKS sets there). */
export const toneDarkInk = (tone: EventTone) => TONE_DARK_INK[tone];
export const toneSoftColor = (tone: EventTone) => TONE_FALLBACK[tone].soft;

// ---------- Categories: the filter's chips ----------------------------------------------------------------------

export type EventCategory =
  | 'comments'
  | 'actions'
  | 'new'
  | 'edits'
  | 'renames'
  | 'deletions'
  | 'sharing'
  | 'teams'
  | 'filing'
  | 'favourites'
  | 'other';

const CATEGORY_BY_TYPE: Record<EventType, EventCategory> = {
  commented: 'comments',
  comment_resolved: 'comments',
  action_assigned: 'actions',
  action_done: 'actions',
  created: 'new',
  edited: 'edits',
  renamed: 'renames',
  team_renamed: 'renames',
  trashed: 'deletions',
  restored: 'deletions',
  shared: 'sharing',
  unshared: 'sharing',
  opened_by_visitor: 'sharing',
  copied_by_visitor: 'sharing',
  team_invite_sent: 'teams',
  team_joined: 'teams',
  team_declined: 'teams',
  team_role_changed: 'teams',
  team_member_removed: 'teams',
  moved: 'filing',
  synced: 'filing',
  favourited: 'favourites',
};

export function eventCategory(type: string): EventCategory {
  return isEventType(type) ? CATEGORY_BY_TYPE[type] : 'other';
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  comments: 'Comments',
  actions: 'Actions',
  new: 'Created',
  edits: 'Edits',
  renames: 'Renames',
  deletions: 'Trash',
  sharing: 'Sharing',
  teams: 'Teams',
  filing: 'Organisation',
  favourites: 'Favourites',
  other: 'Other',
};

// A fixed order, so the chips never rearrange as pages load under them.
const CATEGORY_ORDER: EventCategory[] = [
  'comments',
  'actions',
  'new',
  'edits',
  'renames',
  'deletions',
  'sharing',
  'teams',
  'filing',
  'favourites',
  'other',
];

export function sortCategories(categories: Iterable<EventCategory>): EventCategory[] {
  return [...categories].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
}
