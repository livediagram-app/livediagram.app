// Comment reactions (docs/specs/012-collaboration/comment-reactions.md in each product): a fixed set of six emoji
// anyone who may comment can put on a comment, one of each per person, taken back with a second press. The pure
// core every product shares: the set, the stored shape, the one toggle, the checks a frame or a stored comment
// goes through, and the summary the chips and the agents' thread listings draw from. Nothing here knows who is
// asking or how a reaction travels.

// The six, in the order they are offered and shown. Stored by id, not by the emoji itself, so what a comment
// holds is a short closed list and every product draws the same glyph.
export const COMMENT_REACTIONS = [
  { id: 'thumbs-up', emoji: '👍', name: 'Thumbs Up' },
  { id: 'thumbs-down', emoji: '👎', name: 'Thumbs Down' },
  { id: 'laugh', emoji: '😄', name: 'Laugh' },
  { id: 'hooray', emoji: '🎉', name: 'Hooray' },
  { id: 'heart', emoji: '❤️', name: 'Heart' },
  { id: 'eyes', emoji: '👀', name: 'Eyes' },
] as const;

export type CommentReactionId = (typeof COMMENT_REACTIONS)[number]['id'];
export type CommentReactionDef = (typeof COMMENT_REACTIONS)[number];

// One person's reaction. `by` is their public collab key (the id a done check or an estimate is recorded under,
// never an owner id, which for a guest is their credential); `name` is the name they had when they reacted, kept
// so the list of who reacted reads without the roster.
export type CommentReaction = { emoji: CommentReactionId; by: string; name: string };

// Bounds on what a comment may hold, so a hand-crafted frame cannot bloat a peer: every person once per emoji is
// far more than a real conversation reaches.
export const REACTIONS_PER_COMMENT_MAX = 300;
export const REACTION_BY_MAX = 200;
export const REACTION_NAME_MAX = 100;

const BY_ID = new Map<string, CommentReactionDef>(COMMENT_REACTIONS.map((r) => [r.id, r]));

export function isReactionId(value: unknown): value is CommentReactionId {
  return typeof value === 'string' && BY_ID.has(value);
}

// The emoji and name of a reaction id.
export function reactionDef(id: CommentReactionId): CommentReactionDef {
  return BY_ID.get(id)!;
}

const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

export function isCommentReaction(value: unknown): value is CommentReaction {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    isReactionId(r.emoji) && isText(r.by, REACTION_BY_MAX) && isText(r.name, REACTION_NAME_MAX)
  );
}

// A stored `reactions` field as a comment may keep it: undefined (none) or a bounded list of well-formed
// reactions, one per person per emoji. Anything else is not a comment's reactions.
export function isCommentReactions(value: unknown): value is CommentReaction[] | undefined {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > REACTIONS_PER_COMMENT_MAX) return false;
  const seen = new Set<string>();
  for (const r of value) {
    if (!isCommentReaction(r)) return false;
    const key = `${r.emoji}\u0000${r.by}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

// A reaction change as it travels: `on` adds `by`'s `emoji`, off takes it away.
export type ReactionChange = { emoji: CommentReactionId; by: string; name: string; on: boolean };

export function isReactionChange(value: unknown): value is ReactionChange {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as { on?: unknown }).on === 'boolean' && isCommentReaction(value);
}

// The one toggle. Returns the SAME list when nothing changes (already on, already off, full), so callers keep
// identity; undefined once the last reaction goes, so a comment with none carries no field at all.
export function withReaction(
  reactions: readonly CommentReaction[] | undefined,
  change: ReactionChange,
): CommentReaction[] | undefined {
  const list = reactions ?? [];
  const at = list.findIndex((r) => r.emoji === change.emoji && r.by === change.by);
  if (change.on) {
    if (at >= 0 || list.length >= REACTIONS_PER_COMMENT_MAX) return reactions as CommentReaction[];
    return [...list, { emoji: change.emoji, by: change.by, name: change.name }];
  }
  if (at < 0) return reactions as CommentReaction[];
  const next = list.filter((_, i) => i !== at);
  return next.length ? next : undefined;
}

// A comment with its reactions set, or the field dropped when there are none. Same object when unchanged.
export function commentWithReactions<C extends { reactions?: CommentReaction[] }>(
  comment: C,
  reactions: CommentReaction[] | undefined,
): C {
  if (comment.reactions === reactions) return comment;
  const { reactions: _drop, ...rest } = comment;
  return (reactions ? { ...rest, reactions } : rest) as C;
}

// One chip: an emoji, how many reacted with it, who (names in the order they reacted) and whether `selfKey` did.
export type ReactionGroup = {
  emoji: CommentReactionId;
  count: number;
  names: string[];
  mine: boolean;
};

// The chips a comment shows, in the fixed COMMENT_REACTIONS order, emoji nobody used left out.
export function reactionGroups(
  reactions: readonly CommentReaction[] | undefined,
  selfKey?: string | null,
): ReactionGroup[] {
  if (!reactions?.length) return [];
  const groups = new Map<CommentReactionId, ReactionGroup>();
  for (const r of reactions) {
    const group = groups.get(r.emoji) ?? { emoji: r.emoji, count: 0, names: [], mine: false };
    group.count += 1;
    group.names.push(r.name);
    if (selfKey && r.by === selfKey) group.mine = true;
    groups.set(r.emoji, group);
  }
  return COMMENT_REACTIONS.flatMap((def) => {
    const group = groups.get(def.id);
    return group ? [group] : [];
  });
}

// Whether `selfKey` has reacted with `emoji`.
export function hasReacted(
  reactions: readonly CommentReaction[] | undefined,
  emoji: CommentReactionId,
  selfKey: string | null | undefined,
): boolean {
  return !!selfKey && !!reactions?.some((r) => r.emoji === emoji && r.by === selfKey);
}

// How many names a "who reacted" line spells out before it counts the rest.
export const REACTOR_NAMES_SHOWN = 8;

// Who reacted, as a line: "You", "You and Ana", "Ana, Sam and Lee", "Ana, Sam, … and 4 others". The caller's own
// reaction reads "You" and leads.
export function reactorsLine(
  group: Pick<ReactionGroup, 'names' | 'mine'>,
  selfName?: string,
): string {
  const names = [...group.names];
  if (group.mine) {
    const at = selfName ? names.indexOf(selfName) : -1;
    if (at >= 0) names.splice(at, 1);
    else names.pop();
    names.unshift('You');
  }
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= REACTOR_NAMES_SHOWN) {
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  const rest = names.length - REACTOR_NAMES_SHOWN;
  return `${names.slice(0, REACTOR_NAMES_SHOWN).join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}

// A comment's reactions as an agent reads them (the thread listings and the MCP's thread tools): one entry per
// emoji used, its glyph, its count and who.
export type ReactionSummary = { emoji: string; name: string; count: number; by: string[] };

export function reactionSummary(
  reactions: readonly CommentReaction[] | undefined,
): ReactionSummary[] | undefined {
  const groups = reactionGroups(reactions);
  if (!groups.length) return undefined;
  return groups.map((g) => {
    const def = reactionDef(g.emoji);
    return { emoji: def.emoji, name: def.name, count: g.count, by: g.names };
  });
}

// The reactions as kept on a comment that travels to someone else: each is public (a collab key and a name), so
// nothing is redacted; this only drops a malformed field a stored comment might hold, so it never reaches a peer.
export function cleanReactions(value: unknown): CommentReaction[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: CommentReaction[] = [];
  for (const r of value) {
    if (!isCommentReaction(r) || out.length >= REACTIONS_PER_COMMENT_MAX) continue;
    const key = `${r.emoji}\u0000${r.by}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ emoji: r.emoji, by: r.by, name: r.name });
  }
  return out.length ? out : undefined;
}
