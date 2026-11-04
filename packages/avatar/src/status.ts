// A character's status in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Status"): how you are, shown to the
// room without a word. Presence for the session only; nothing here is stored.

import type { AvatarStatus } from '@liveworkspace/api-schema/avatar';

export type { AvatarStatus };

export type AvatarStatusEntry = { id: AvatarStatus; label: string; colour: string };

/** The four statuses every product offers, in the panel's order. */
export const AVATAR_STATUSES: readonly AvatarStatusEntry[] = [
  { id: 'available', label: 'Available', colour: '#22c55e' },
  { id: 'focus', label: 'Focusing', colour: '#8b5cf6' },
  { id: 'meeting', label: 'In a Meeting', colour: '#ef4444' },
  { id: 'away', label: 'Away', colour: '#94a3b8' },
];

/**
 * Do Not Disturb, the calls' status (livehuddle's docs/specs/012-collaboration/meeting-rooms-and-stage.md "Do Not
 * Disturb"): a rose dot with a white bar, set apart from In a Meeting's red by the bar. Offered only by a product
 * with calls; every product parses and draws it.
 */
export const AVATAR_DND_STATUS: AvatarStatusEntry = {
  id: 'dnd',
  label: 'Do Not Disturb',
  colour: '#e11d48',
};

/** The five a product with calls offers: the four, then Do Not Disturb. */
export const AVATAR_CALL_STATUSES: readonly AvatarStatusEntry[] = [
  ...AVATAR_STATUSES,
  AVATAR_DND_STATUS,
];

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
