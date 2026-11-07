// The avatar palette's pure parts (docs/specs/008-canvas/avatar-mode.md "The avatar palette"): which strip a session
// gets, the categories it shows, Title Case labels, and the still pose a Behaviour card draws. No React, so every
// rule here is unit-tested on its own.

import type { EditorCapabilities } from '@/lib/editor-capabilities';
import {
  reactionPose,
  type AvatarReactionKind,
  type ReactionPose,
} from '@liveworkspace/avatar/reactions';

/** Which strip sits at the top of the canvas: the building palette, the avatar palette, or none. */
export type StripPalette = 'build' | 'avatar' | null;

/**
 * The strip for this session (docs/specs/013-workspace/share-roles.md), from `can`, never `isReadOnly` alone:
 * walking (or a Participant or a Viewer, which always walk) gets the avatar palette whatever its level; otherwise only
 * an Editor that may edit (`readOnly` false) gets the building palette. The avatar palette has no selection-mode
 * picker for anyone: an Editor leaves with the Walk button, and the others never leave ("Always walking").
 */
export function stripPaletteFor({
  can,
  readOnly,
  walking,
}: {
  can: Pick<EditorCapabilities, 'level' | 'alwaysWalks'>;
  // The session's read-only flag: below an Editor, or a tab still loading.
  readOnly: boolean;
  walking: boolean;
}): StripPalette {
  if (walking || can.alwaysWalks) return 'avatar';
  return can.level === 'edit' && !readOnly ? 'build' : null;
}

/**
 * The avatar palette's categories, in strip order: the look on the left (band 0), the actions on the right (1). Owner,
 * 2026-11-06: "Character -> Gender", "Reactions -> React, Behaviour -> Actions"; the ids stay as they were.
 */
export const AVATAR_PALETTE_CATEGORIES = [
  {
    id: 'character',
    label: 'Gender',
    description: 'Your portrait, male or female, or a new look at random.',
    group: 0,
  },
  { id: 'clothes', label: 'Clothes', description: 'What your character wears.', group: 0 },
  { id: 'hair', label: 'Hair', description: 'How your character wears its hair.', group: 0 },
  {
    id: 'status',
    label: 'Status',
    description: 'Let people know if you are free, and what you hear.',
    group: 0,
  },
  {
    id: 'behaviour',
    label: 'Actions',
    description: 'Wave, spin or dance on the spot. Everyone sees it.',
    group: 1,
  },
  {
    id: 'reactions',
    label: 'React',
    description: 'Throw a burst of something around you.',
    group: 1,
  },
] as const;

export type AvatarPaletteCategoryId = (typeof AVATAR_PALETTE_CATEGORIES)[number]['id'];

// The short words Title Case leaves lower case, after the first word.
const MINOR_WORDS = new Set(['a', 'an', 'and', 'at', 'in', 'of', 'on', 'or', 'the', 'to']);

/** A catalogue label in Title Case ("Lab coat" reads "Lab Coat"), whatever the shared catalogue spells. */
export function titleCase(label: string): string {
  return label.replace(
    /(^|[\s-])(\p{Ll}[\p{L}']*)/gu,
    (match, gap: string, word: string, at: number) =>
      at > 0 && gap !== '-' && MINOR_WORDS.has(word)
        ? match
        : gap + word[0]!.toUpperCase() + word.slice(1),
  );
}

// The moment of each Behaviour a card freezes: the one that says what the move is (arms out for a jack, raised for
// a cheer), in ms into the performance.
const STILL_AT_MS: Record<AvatarReactionKind, number> = {
  'jumping-jacks': 180,
  wave: 0,
  spin: 150,
  cheer: 0,
  dance: 0,
};

/** The pose a Behaviour card draws: the performance at its telling moment, on the ground (a card has no headroom). */
export function behaviourStill(kind: AvatarReactionKind): ReactionPose {
  return { ...reactionPose(kind, STILL_AT_MS[kind]), lift: 0 };
}
