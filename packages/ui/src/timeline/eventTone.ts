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

export type TimelineTone = 'danger' | 'structural' | 'create' | 'neutral';

// Destruction and loss of access. The smallest set that earns red: if
// everything worrying is red, nothing is.
const DANGER = new Set<string>([
  'diagram_deleted',
  'team_member_removed',
  // Not `team_member_left`: leaving is a departure the person chose,
  // and colouring it the same as being removed misreads the room.
]);

// The shape of things changed. Nothing was lost, but something a
// reader might rely on is no longer where or what it was: a name, who
// is in a team, who can reach a diagram.
const STRUCTURAL = new Set<string>([
  'diagram_renamed',
  'diagram_moved',
  'diagram_offline',
  'diagram_synced',
  'team_diagram_added',
  'team_created',
  'team_invite_received',
  'team_invite_accepted',
  'team_invite_declined',
  'team_member_joined',
  'team_member_left',
  'team_role_changed',
  'share_link_created',
  // The forward-dated warnings. They're structural in the same sense —
  // access is about to change — and amber is already the colour a
  // reader expects for "this needs attention before it bites".
  'share_link_expiring',
  'token_expiring',
]);

// Things made, edited, said, or finished: the ordinary business of
// using the product, and the bulk of any active day.
const CREATE = new Set<string>([
  'diagram_created',
  'diagram_edited',
  'diagram_duplicated',
  'comment_added',
  'comment_resolved',
  'action_assigned',
  'action_completed',
  'token_created',
  'theme_saved',
  'image_uploaded',
]);

export function eventTone(eventType: string): TimelineTone {
  if (DANGER.has(eventType)) return 'danger';
  if (STRUCTURAL.has(eventType)) return 'structural';
  if (CREATE.has(eventType)) return 'create';
  return 'neutral';
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
