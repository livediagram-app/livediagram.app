// Home's Spaces, in words and order (liveworkspace/docs/specs/004-index/one-explorer.md "Spaces, on Home"): which spaces
// show and in what order, the tone a team's disc wears, and the line under each tile's name.

import { FOLDER_PREVIEW_COUNT_CAP, type SpacePreview } from '@liveworkspace/index-client';
import type { TeamRef } from '../types';
import { relativeSince } from '../time';
import type { Words } from '../words';

/** Up to this many tiles show before Show All: two rows of four on a desktop. */
export const SPACES_SHOWN = 8;

export const SPACES_COPY = {
  title: 'Spaces',
  // livehuddle's items are Spaces: there the section says Workspaces, so it never heads tiles counting "3 spaces".
  titleWhereItemsAreSpaces: 'Workspaces',
  myWork: 'My Work',
  createTeam: 'Create a Team',
  signIn: 'Sign In to Work in Teams',
  showFewer: 'Show Fewer',
  failed: 'Couldn’t load what’s in your spaces.',
} as const;

export type SpaceEntry = {
  // Null for My Work.
  teamId: string | null;
  name: string;
  preview: SpacePreview | null;
};

const newestAt = (s: SpaceEntry) => s.preview?.items[0]?.updatedAt ?? null;

/** My Work first, then the teams: the one changed most recently first, then those holding nothing yet (or not yet
 *  answered) by name. */
export function orderSpaces(
  teams: readonly TeamRef[],
  byTeam: ReadonlyMap<string | null, SpacePreview> | null,
  collator: Intl.Collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }),
): SpaceEntry[] {
  const mine: SpaceEntry = {
    teamId: null,
    name: SPACES_COPY.myWork,
    preview: byTeam?.get(null) ?? null,
  };
  const rest = teams.map((t): SpaceEntry => ({
    teamId: t.id,
    name: t.name,
    preview: byTeam?.get(t.id) ?? null,
  }));
  rest.sort((a, b) => {
    const at = newestAt(a);
    const bt = newestAt(b);
    if (at !== null && bt !== null && at !== bt) return bt - at;
    if (at !== null && bt === null) return -1;
    if (at === null && bt !== null) return 1;
    return collator.compare(a.name, b.name);
  });
  return [mine, ...rest];
}

// The six tones a team wears (its disc, and the wash behind its mosaic): the sidebar's own, less My Work's sky.
export type SpaceTone = { disc: string; wash: string };
export const SPACE_TONES: readonly SpaceTone[] = [
  {
    disc: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
    wash: 'bg-indigo-50/70 dark:bg-indigo-400/[0.06]',
  },
  {
    disc: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    wash: 'bg-violet-50/70 dark:bg-violet-400/[0.06]',
  },
  {
    disc: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    wash: 'bg-emerald-50/70 dark:bg-emerald-400/[0.06]',
  },
  {
    disc: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    wash: 'bg-amber-50/70 dark:bg-amber-400/[0.06]',
  },
  {
    disc: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
    wash: 'bg-rose-50/70 dark:bg-rose-400/[0.06]',
  },
  {
    disc: 'bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
    wash: 'bg-teal-50/70 dark:bg-teal-400/[0.06]',
  },
];
export const MY_WORK_TONE: SpaceTone = {
  disc: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  wash: 'bg-sky-50/70 dark:bg-sky-400/[0.06]',
};

/** A space's tone: My Work's sky, or a team's picked from its id, so it wears the same colour on every visit. */
/** This Browser's tile: the teal its pill and sidebar tile wear (no app's accent, no team's tone). */
export const LOCAL_SPACE_TONE: SpaceTone = {
  disc: 'bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
  wash: 'bg-teal-50/70 dark:bg-teal-400/[0.06]',
};

/** This Browser's tile's line, from its list: "3 plans · Edited 2 hours ago" (just the count before the clock is
 *  known, "No plans yet" with folders alone). */
export function localSpaceLine(
  count: number,
  newest: number | null,
  words: Pick<Words, 'lowerOne' | 'lowerMany'>,
  now: number | null,
): string {
  return spaceLine(
    {
      teamId: null,
      itemCount: count,
      items: newest === null ? [] : [{ updatedAt: newest }],
    } as SpacePreview,
    words,
    now,
  );
}

export function spaceTone(teamId: string | null): SpaceTone {
  if (teamId === null) return MY_WORK_TONE;
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) hash = (hash * 31 + teamId.charCodeAt(i)) >>> 0;
  return SPACE_TONES[hash % SPACE_TONES.length]!;
}

/** "12 plans", "1000+ plans", "No plans yet". */
export function spaceCount(itemCount: number, words: Pick<Words, 'lowerOne' | 'lowerMany'>) {
  if (itemCount === 0) return `No ${words.lowerMany} yet`;
  const n = itemCount >= FOLDER_PREVIEW_COUNT_CAP ? `${FOLDER_PREVIEW_COUNT_CAP}+` : `${itemCount}`;
  return `${n} ${itemCount === 1 ? words.lowerOne : words.lowerMany}`;
}

/** The tile's line: "12 plans · Edited 2 hours ago"; just the count while the clock is unknown or it holds nothing. */
export function spaceLine(
  preview: SpacePreview,
  words: Pick<Words, 'lowerOne' | 'lowerMany'>,
  now: number | null,
): string {
  const count = spaceCount(preview.itemCount, words);
  const newest = preview.items[0]?.updatedAt;
  if (newest === undefined || now === null) return count;
  return `${count} · Edited ${relativeSince(newest, now)}`;
}

/** "Show All 12 Spaces". */
export const showAllLabel = (count: number, title: string) => `Show All ${count} ${title}`;

/** The people behind a space's newest items, newest first, each once, the viewer left out: at most three. */
export function spaceFaces(preview: SpacePreview | null, viewerId: string | null): string[] {
  if (!preview) return [];
  const out: string[] = [];
  for (const item of preview.items) {
    if (item.ownerId === viewerId || out.includes(item.ownerId)) continue;
    out.push(item.ownerId);
    if (out.length === 3) break;
  }
  return out;
}
