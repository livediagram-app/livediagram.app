// A character's status in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Status"): how you are, shown to the
// room without a word. Presence for the session only; nothing here is stored.

import type { AvatarStatus } from '@liveworkspace/api-schema/avatar';

export type { AvatarStatus };

/** A status: its token, its Title Case name, its dot's colour and the short line under its name in a picker. */
export type AvatarStatusEntry = { id: AvatarStatus; label: string; colour: string; line: string };

const AVAILABLE: AvatarStatusEntry = {
  id: 'available',
  label: 'Available',
  colour: '#22c55e',
  line: 'Free to chat. A green sparkle.',
};
const FOCUS: AvatarStatusEntry = {
  id: 'focus',
  label: 'Focusing',
  colour: '#8b5cf6',
  line: 'Heads down, headphones on.',
};
const MEETING: AvatarStatusEntry = {
  id: 'meeting',
  label: 'In a Meeting',
  colour: '#ef4444',
  line: 'On a call, headset and mic on.',
};
const AWAY: AvatarStatusEntry = {
  id: 'away',
  label: 'Away',
  colour: '#94a3b8',
  line: 'Stepped away. You fade and a Zz rises.',
};

/** The four statuses every product offers, in the panel's order. */
export const AVATAR_STATUSES: readonly AvatarStatusEntry[] = [AVAILABLE, FOCUS, MEETING, AWAY];

/**
 * Do Not Disturb, the calls' status (livehuddle's docs/specs/012-collaboration/meeting-rooms-and-stage.md "Do Not
 * Disturb"): a rose dot with a white bar, set apart from In a Meeting's red by the bar. Offered only by a product
 * with calls; every product parses and draws it.
 */
export const AVATAR_DND_STATUS: AvatarStatusEntry = {
  id: 'dnd',
  label: 'Do Not Disturb',
  colour: '#e11d48',
  line: 'Mutes voices. A no-entry sign.',
};

/**
 * The two statuses livehuddle's seat pieces set (its docs/specs/009-elements/workday-pieces.md "Statuses a piece
 * sets"): On a Break from a Treadmill or a Weight Bench, Busy from a Phone Booth. Anyone may pick them too.
 */
export const AVATAR_BREAK_STATUS: AvatarStatusEntry = {
  id: 'break',
  label: 'On a Break',
  colour: '#3b82f6',
  line: 'Stretching the legs, water in hand.',
};
export const AVATAR_BUSY_STATUS: AvatarStatusEntry = {
  id: 'busy',
  label: 'Busy',
  colour: '#a16207',
  line: 'On the phone, back in a bit.',
};

/** livehuddle's Availability group: can people come over? */
export const AVATAR_AVAILABILITY_STATUSES: readonly AvatarStatusEntry[] = [
  AVAILABLE,
  {
    id: 'help',
    label: 'Need Help',
    colour: '#f59e0b',
    line: 'Stuck? A question mark bobs overhead.',
  },
  AWAY,
  AVATAR_BUSY_STATUS,
  AVATAR_DND_STATUS,
];

/** livehuddle's Activity group: what you are busy with. */
export const AVATAR_ACTIVITY_STATUSES: readonly AvatarStatusEntry[] = [
  FOCUS,
  MEETING,
  {
    id: 'lunch',
    label: 'Out to Lunch',
    colour: '#14b8a6',
    line: 'Back soon, sandwich in hand.',
  },
  AVATAR_BREAK_STATUS,
];

/** livehuddle's Mood group: how you feel. Cosmetic, each with its signature on the character. */
export const AVATAR_MOOD_STATUSES: readonly AvatarStatusEntry[] = [
  { id: 'angry', label: 'Angry', colour: '#f97316', line: 'Steam puffs from both ears.' },
  {
    id: 'celebrating',
    label: 'Celebrating',
    colour: '#ec4899',
    line: 'A party hat and falling confetti.',
  },
  {
    id: 'thinking',
    label: 'Thinking',
    colour: '#0ea5e9',
    line: 'A thought bubble, mulling it over.',
  },
  { id: 'sick', label: 'Feeling Sick', colour: '#84cc16', line: 'A green face and an ice pack.' },
];

/** livehuddle's status groups, in its picker's order, each under its name. */
export const AVATAR_STATUS_GROUPS: readonly {
  name: string;
  statuses: readonly AvatarStatusEntry[];
}[] = [
  { name: 'Availability', statuses: AVATAR_AVAILABILITY_STATUSES },
  { name: 'Activity', statuses: AVATAR_ACTIVITY_STATUSES },
  { name: 'Mood', statuses: AVATAR_MOOD_STATUSES },
];

/** Every status a product with calls offers (livehuddle): its groups in order. */
export const AVATAR_CALL_STATUSES: readonly AvatarStatusEntry[] = AVATAR_STATUS_GROUPS.flatMap(
  (g) => g.statuses,
);

const BY_ID = new Map(AVATAR_CALL_STATUSES.map((s) => [s.id, s]));

/** A status from the wire, or null for anything this build does not know. */
export function parseAvatarStatus(value: unknown): AvatarStatus | null {
  return typeof value === 'string' && BY_ID.has(value as AvatarStatus)
    ? (value as AvatarStatus)
    : null;
}

export function avatarStatusLabel(status: AvatarStatus): string {
  return BY_ID.get(status)!.label;
}

export function avatarStatusColour(status: AvatarStatus): string {
  return BY_ID.get(status)!.colour;
}

export function avatarStatusLine(status: AvatarStatus): string {
  return BY_ID.get(status)!.line;
}
