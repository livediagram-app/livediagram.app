// Avatar-mode action keys (docs/specs/008-canvas/avatar-mode.md "Keyboard actions"): the Avatar Panel's
// Behaviour performances on a mnemonic letter each, and its five Reaction bursts on 1 to 5 in the panel's
// order, so a presenter can wave or throw confetti without opening the panel mid-walk.
//
// Pure: a key in, an action (or null) out. useAvatarActionKeys plays it; useEditorKeyboardShortcuts asks the
// same question so it stands aside for these keys while walking (S would otherwise open search, 1 pick Select).

import { REACTIONS, type Reaction } from '@livediagram/document';
import type { AvatarReactionKind } from './avatar-reactions';

// The letter each Behaviour answers to: its initial, so the key is the word.
export const AVATAR_BEHAVIOUR_KEYS: Record<AvatarReactionKind, string> = {
  'jumping-jacks': 'J',
  wave: 'W',
  spin: 'S',
  cheer: 'C',
  dance: 'D',
};

// The digit each Reaction burst answers to: its place in the panel's row (REACTIONS order).
export const AVATAR_BURST_KEYS: Record<Reaction, string> = Object.fromEntries(
  REACTIONS.map((r, i) => [r, String(i + 1)]),
) as Record<Reaction, string>;

export type AvatarKeyAction =
  { type: 'behaviour'; kind: AvatarReactionKind } | { type: 'burst'; reaction: Reaction };

const BY_KEY = new Map<string, AvatarKeyAction>([
  ...Object.entries(AVATAR_BEHAVIOUR_KEYS).map(
    ([kind, key]) =>
      [key.toLowerCase(), { type: 'behaviour', kind: kind as AvatarReactionKind }] as const,
  ),
  ...REACTIONS.map(
    (reaction) => [AVATAR_BURST_KEYS[reaction], { type: 'burst', reaction }] as const,
  ),
]);

// The action a plain key press asks for, or null. Any modifier (Shift+D is the mode switch, Cmd+C copies)
// and an autorepeat from a held key ask for nothing: one press, one performance.
export function avatarActionForKey(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
}): AvatarKeyAction | null {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return null;
  return BY_KEY.get(e.key.toLowerCase()) ?? null;
}
