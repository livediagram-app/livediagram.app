// A character's status in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Status"): how you are, shown to the
// room without a word. Presence for the session only; nothing here is stored.

export type AvatarStatus = 'available' | 'focus' | 'meeting' | 'away';

export const AVATAR_STATUSES: readonly { id: AvatarStatus; label: string; colour: string }[] = [
  { id: 'available', label: 'Available', colour: '#22c55e' },
  { id: 'focus', label: 'Focusing', colour: '#8b5cf6' },
  { id: 'meeting', label: 'In a Meeting', colour: '#ef4444' },
  { id: 'away', label: 'Away', colour: '#94a3b8' },
];

const BY_ID = new Map(AVATAR_STATUSES.map((s) => [s.id, s]));

/** A status from the wire, or null for anything this build does not know. */
export function parseAvatarStatus(value: unknown): AvatarStatus | null {
  return typeof value === 'string' && BY_ID.has(value as AvatarStatus) ? (value as AvatarStatus) : null;
}

export function avatarStatusLabel(status: AvatarStatus): string {
  return BY_ID.get(status)!.label;
}

export function avatarStatusColour(status: AvatarStatus): string {
  return BY_ID.get(status)!.colour;
}
