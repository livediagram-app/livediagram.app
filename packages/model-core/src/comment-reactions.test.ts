import { describe, expect, it } from 'vitest';
import {
  COMMENT_REACTIONS,
  REACTIONS_PER_COMMENT_MAX,
  REACTOR_NAMES_SHOWN,
  cleanReactions,
  commentWithReactions,
  hasReacted,
  isCommentReaction,
  isCommentReactions,
  isReactionChange,
  isReactionId,
  reactionDef,
  reactionGroups,
  reactionSummary,
  reactorsLine,
  withReaction,
  type CommentReaction,
} from './comment-reactions';

const ana: CommentReaction = { emoji: 'thumbs-up', by: 'k-ana', name: 'Ana' };
const sam: CommentReaction = { emoji: 'thumbs-up', by: 'k-sam', name: 'Sam' };
const samEyes: CommentReaction = { emoji: 'eyes', by: 'k-sam', name: 'Sam' };

describe('the set', () => {
  it('offers six, each a distinct id and emoji', () => {
    expect(COMMENT_REACTIONS).toHaveLength(6);
    expect(new Set(COMMENT_REACTIONS.map((r) => r.id)).size).toBe(6);
    expect(new Set(COMMENT_REACTIONS.map((r) => r.emoji)).size).toBe(6);
    expect(COMMENT_REACTIONS.map((r) => r.emoji)).toEqual(['👍', '👎', '😄', '🎉', '❤️', '👀']);
  });

  it('knows its ids and nothing else', () => {
    expect(isReactionId('eyes')).toBe(true);
    expect(isReactionId('rocket')).toBe(false);
    expect(isReactionId(1)).toBe(false);
    expect(reactionDef('heart')).toEqual({ id: 'heart', emoji: '❤️', name: 'Heart' });
  });
});

describe('checks', () => {
  it('takes a well-formed reaction and refuses the rest', () => {
    expect(isCommentReaction(ana)).toBe(true);
    expect(isCommentReaction(null)).toBe(false);
    expect(isCommentReaction('x')).toBe(false);
    expect(isCommentReaction({ ...ana, emoji: 'rocket' })).toBe(false);
    expect(isCommentReaction({ ...ana, by: '' })).toBe(false);
    expect(isCommentReaction({ ...ana, by: 'k'.repeat(201) })).toBe(false);
    expect(isCommentReaction({ ...ana, name: 'n'.repeat(101) })).toBe(false);
  });

  it('takes a stored list: none, or bounded and one per person per emoji', () => {
    expect(isCommentReactions(undefined)).toBe(true);
    expect(isCommentReactions([ana, sam, samEyes])).toBe(true);
    expect(isCommentReactions('x')).toBe(false);
    expect(isCommentReactions([ana, { ...ana }])).toBe(false);
    expect(isCommentReactions([{ ...ana, emoji: 'nope' }])).toBe(false);
    const full = Array.from({ length: REACTIONS_PER_COMMENT_MAX + 1 }, (_, i) => ({
      ...ana,
      by: `k-${i}`,
    }));
    expect(isCommentReactions(full)).toBe(false);
  });

  it('takes a change only with its on flag', () => {
    expect(isReactionChange({ ...ana, on: true })).toBe(true);
    expect(isReactionChange(ana)).toBe(false);
    expect(isReactionChange(null)).toBe(false);
    expect(isReactionChange({ ...ana, emoji: 'x', on: false })).toBe(false);
  });
});

describe('withReaction', () => {
  it('adds one, in the order they came', () => {
    expect(withReaction(undefined, { ...ana, on: true })).toEqual([ana]);
    expect(withReaction([ana], { ...sam, on: true })).toEqual([ana, sam]);
  });

  it('keeps one per person per emoji, and the same list when nothing changes', () => {
    const list = [ana];
    expect(withReaction(list, { ...ana, on: true })).toBe(list);
    expect(withReaction(list, { ...sam, on: false })).toBe(list);
    expect(withReaction(undefined, { ...sam, on: false })).toBeUndefined();
  });

  it('takes one away, and the field with the last', () => {
    expect(withReaction([ana, sam], { ...ana, on: false })).toEqual([sam]);
    expect(withReaction([ana], { ...ana, on: false })).toBeUndefined();
  });

  it('stops at the bound', () => {
    const full = Array.from({ length: REACTIONS_PER_COMMENT_MAX }, (_, i) => ({
      ...ana,
      by: `k-${i}`,
    }));
    expect(withReaction(full, { ...sam, by: 'new', on: true })).toBe(full);
  });

  it('keeps only the stored fields', () => {
    expect(withReaction(undefined, { ...ana, on: true })![0]).toEqual(ana);
  });
});

describe('commentWithReactions', () => {
  it('sets, drops and keeps identity', () => {
    const c: { id: string; reactions?: CommentReaction[] } = { id: 'c1' };
    expect(commentWithReactions(c, undefined)).toBe(c);
    const withOne = commentWithReactions(c, [ana]);
    expect(withOne).toEqual({ id: 'c1', reactions: [ana] });
    expect(commentWithReactions(withOne, withOne.reactions)).toBe(withOne);
    expect(commentWithReactions(withOne, undefined)).toEqual({ id: 'c1' });
  });
});

describe('reactionGroups', () => {
  it('groups by emoji in the fixed order, marking mine', () => {
    expect(reactionGroups([samEyes, ana, sam], 'k-ana')).toEqual([
      { emoji: 'thumbs-up', count: 2, names: ['Ana', 'Sam'], mine: true },
      { emoji: 'eyes', count: 1, names: ['Sam'], mine: false },
    ]);
  });

  it('is empty for none, and mine is false without a key', () => {
    expect(reactionGroups(undefined)).toEqual([]);
    expect(reactionGroups([])).toEqual([]);
    expect(reactionGroups([ana])[0]!.mine).toBe(false);
  });

  it('hasReacted answers per emoji', () => {
    expect(hasReacted([ana], 'thumbs-up', 'k-ana')).toBe(true);
    expect(hasReacted([ana], 'eyes', 'k-ana')).toBe(false);
    expect(hasReacted([ana], 'thumbs-up', null)).toBe(false);
    expect(hasReacted(undefined, 'thumbs-up', 'k-ana')).toBe(false);
  });
});

describe('reactorsLine', () => {
  it('names one, two, a few', () => {
    expect(reactorsLine({ names: ['Ana'], mine: false })).toBe('Ana');
    expect(reactorsLine({ names: ['Ana', 'Sam'], mine: false })).toBe('Ana and Sam');
    expect(reactorsLine({ names: ['Ana', 'Sam', 'Lee'], mine: false })).toBe('Ana, Sam and Lee');
    expect(reactorsLine({ names: [], mine: false })).toBe('');
  });

  it('leads with You for your own, by name or else the last', () => {
    expect(reactorsLine({ names: ['Ana', 'Sam'], mine: true }, 'Sam')).toBe('You and Ana');
    expect(reactorsLine({ names: ['Ana'], mine: true }, 'Ana')).toBe('You');
    expect(reactorsLine({ names: ['Ana', 'Old name'], mine: true }, 'New name')).toBe(
      'You and Ana',
    );
    expect(reactorsLine({ names: ['Ana', 'Me'], mine: true })).toBe('You and Ana');
  });

  it('counts the rest past the shown names', () => {
    const names = Array.from({ length: REACTOR_NAMES_SHOWN + 1 }, (_, i) => `P${i}`);
    expect(reactorsLine({ names, mine: false })).toMatch(/and 1 other$/);
    expect(reactorsLine({ names: [...names, 'Z'], mine: false })).toMatch(/and 2 others$/);
  });
});

describe('reactionSummary', () => {
  it('reads for an agent: glyph, name, count and who', () => {
    expect(reactionSummary([ana, sam, samEyes])).toEqual([
      { emoji: '👍', name: 'Thumbs Up', count: 2, by: ['Ana', 'Sam'] },
      { emoji: '👀', name: 'Eyes', count: 1, by: ['Sam'] },
    ]);
    expect(reactionSummary(undefined)).toBeUndefined();
  });
});

describe('cleanReactions', () => {
  it('keeps the well-formed, once each, bounded, and drops extra fields', () => {
    expect(cleanReactions('x')).toBeUndefined();
    expect(cleanReactions([])).toBeUndefined();
    expect(cleanReactions([{ ...ana, extra: 1 }, ana, { emoji: 'x' }, sam])).toEqual([ana, sam]);
    const many = Array.from({ length: REACTIONS_PER_COMMENT_MAX + 5 }, (_, i) => ({
      ...ana,
      by: `k-${i}`,
    }));
    expect(cleanReactions(many)).toHaveLength(REACTIONS_PER_COMMENT_MAX);
  });
});
