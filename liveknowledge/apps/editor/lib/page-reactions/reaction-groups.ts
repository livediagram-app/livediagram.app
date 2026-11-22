// What the capsule draws of a page's reactions (docs/specs/030-knowledgebase/page-reactions.md "Where they show"):
// one group an emoji used, in the order each was first used, with its count, who and whether it is yours; the quick
// picks; and the one change a reaction makes to a list. Pure, shared by the store and the capsule.
import type { PageReaction } from '@liveknowledge/api-schema';

/** The quick picks, first in the picker. */
export const QUICK_PAGE_REACTIONS = [
  { emoji: '👏', name: 'Clap' },
  { emoji: '❤️', name: 'Heart' },
  { emoji: '👍', name: 'Thumbs Up' },
  { emoji: '🎉', name: 'Party' },
  { emoji: '👀', name: 'Eyes' },
] as const;

const QUICK_NAMES = new Map<string, string>(QUICK_PAGE_REACTIONS.map((q) => [q.emoji, q.name]));

/** A quick pick's name; null for any other emoji (the picker's list names those once it has loaded). */
export const quickReactionName = (emoji: string): string | null => QUICK_NAMES.get(emoji) ?? null;

export type PageReactionGroup = { emoji: string; count: number; names: string[]; mine: boolean };

/** The groups, in the order each emoji was first used. `selfKey` marks yours. */
export function reactionGroupsOf(
  reactions: readonly PageReaction[],
  selfKey: string | null,
): PageReactionGroup[] {
  const groups = new Map<string, PageReactionGroup>();
  for (const r of reactions) {
    let group = groups.get(r.emoji);
    if (!group) {
      group = { emoji: r.emoji, count: 0, names: [], mine: false };
      groups.set(r.emoji, group);
    }
    group.count += 1;
    group.names.push(r.name);
    if (selfKey !== null && r.by === selfKey) group.mine = true;
  }
  return [...groups.values()];
}

/** Whether `by` has reacted with `emoji`. */
export const hasPageReaction = (
  reactions: readonly PageReaction[],
  emoji: string,
  by: string | null,
): boolean => by !== null && reactions.some((r) => r.emoji === emoji && r.by === by);

/** The list with `reaction` added (`on`) or taken away. The SAME list when nothing changes. */
export function withPageReaction(
  reactions: readonly PageReaction[],
  reaction: PageReaction,
  on: boolean,
): readonly PageReaction[] {
  const there = hasPageReaction(reactions, reaction.emoji, reaction.by);
  if (on === there) return reactions;
  return on
    ? [...reactions, reaction]
    : reactions.filter((r) => !(r.emoji === reaction.emoji && r.by === reaction.by));
}

/** How many segments the capsule shows before it folds the rest into +N. */
export const CAPSULE_SEGMENTS = 5;
export const CAPSULE_SEGMENTS_NARROW = 2;

/** The first `room` groups, and how many fold into +N after them. */
export function capsuleSplit<T>(groups: readonly T[], room: number): { shown: T[]; more: number } {
  return { shown: groups.slice(0, room), more: Math.max(0, groups.length - room) };
}
