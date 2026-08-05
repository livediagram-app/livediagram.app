// What an event's colour MEANS (spec/138 §2).
//
// Colour keys on what happened, not on which part of the product it
// happened in. A reader scanning a busy day is asking "is any of this
// alarming?" long before they ask "was that a diagram or a team", and
// only the first question has a useful colour answer. Source type is
// still how the filter chips slice the feed — that's a different axis,
// and it's the one you'd use to hide a whole area.
//
// Three tones, deliberately few. A palette with six meanings is a
// legend the reader has to learn; three are legible at a glance:
//
//   danger      something was destroyed or someone lost access
//   structural  the shape of things changed — names, teams, sharing
//   create      something was made, edited, or finished
//
// Anything unmapped falls to `neutral` rather than guessing, so a new
// event type from a newer worker reads as plain rather than as a
// deletion.

import type { KnownTimelineEventType } from '@livediagram/api-schema';

export type TimelineTone = 'danger' | 'structural' | 'create' | 'neutral';

// Every event type's tone, in one exhaustive map.
//
// `Record<KnownTimelineEventType, …>` rather than three Sets of loose strings:
// the compiler now refuses a new event type until it has a tone, which is the
// only way this stays true. Grouped by tone in reading order, with the
// reasoning that used to sit on each Set kept where it was.
const TONE_BY_EVENT: Record<KnownTimelineEventType, TimelineTone> = {
  // ---- danger ----
  // Destruction and loss of access. The smallest set that earns red: if
  // everything worrying is red, nothing is.
  diagram_deleted: 'danger',
  team_member_removed: 'danger',
  team_deleted: 'danger',
  folder_deleted: 'danger',
  // Revoking a token breaks whatever was using it, which is the same
  // shape of surprise as a deletion.
  token_revoked: 'danger',
  theme_deleted: 'danger',
  // Note `team_member_left` is NOT danger: leaving is a departure the person
  // chose, and colouring it the same as being removed misreads the room.

  // ---- structural ----
  // The shape of things changed. Nothing was lost, but something a
  // reader might rely on is no longer where or what it was: a name, who
  // is in a team, who can reach a diagram.
  diagram_renamed: 'structural',
  diagram_moved: 'structural',
  diagram_offline: 'structural',
  diagram_synced: 'structural',
  team_diagram_added: 'structural',
  team_diagram_removed: 'structural',
  team_created: 'structural',
  team_invite_received: 'structural',
  team_invite_accepted: 'structural',
  team_invite_declined: 'structural',
  team_member_joined: 'structural',
  team_member_left: 'structural',
  team_role_changed: 'structural',
  share_link_created: 'structural',
  // The forward-dated warnings. They're structural in the same sense —
  // access is about to change — and amber is already the colour a
  // reader expects for "this needs attention before it bites".
  share_link_expiring: 'structural',
  token_expiring: 'structural',
  team_renamed: 'structural',
  team_invite_link_enabled: 'structural',
  team_invite_link_disabled: 'structural',

  // ---- create ----
  // Things made, edited, said, or finished: the ordinary business of
  // using the product, and the bulk of any active day.
  diagram_created: 'create',
  diagram_edited: 'create',
  diagram_duplicated: 'create',
  comment_added: 'create',
  comment_resolved: 'create',
  action_assigned: 'create',
  action_completed: 'create',
  token_created: 'create',
  theme_saved: 'create',
  image_uploaded: 'create',
  folder_created: 'create',
  // Somebody reaching your work is the good kind of news, and the whole
  // reason to share a link in the first place.
  diagram_opened_by_visitor: 'create',
  diagram_copied_by_visitor: 'create',
};

export function eventTone(eventType: string): TimelineTone {
  return TONE_BY_EVENT[eventType as KnownTimelineEventType] ?? 'neutral';
}

export const TONE_LABELS: Record<TimelineTone, string> = {
  danger: 'Removed',
  structural: 'Changed',
  create: 'Created',
  neutral: 'Other',
};

// Fallbacks used when the host app hasn't defined the CSS variables —
// the components stay renderable standalone. `bold` paints the icon and
// the calendar dot; `soft` is the bubble's whole background, so it has
// to sit quietly under body text rather than compete with it.
const FALLBACK: Record<TimelineTone, { bold: string; soft: string }> = {
  danger: { bold: '#dc2626', soft: 'rgba(220, 38, 38, 0.10)' },
  structural: { bold: '#d97706', soft: 'rgba(217, 119, 6, 0.10)' },
  create: { bold: '#059669', soft: 'rgba(5, 150, 105, 0.10)' },
  neutral: { bold: '#64748b', soft: 'rgba(100, 116, 139, 0.10)' },
};

export function toneColor(tone: TimelineTone): string {
  return `var(--ld-timeline-${tone}, ${FALLBACK[tone].bold})`;
}

export function toneSoftColor(tone: TimelineTone): string {
  return `var(--ld-timeline-${tone}-soft, ${FALLBACK[tone].soft})`;
}
