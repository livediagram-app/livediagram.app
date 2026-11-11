import { describe, expect, it } from 'vitest';
import {
  threadResolved,
  threadWithComment,
  threadWithoutComment,
  type CommentThreadOf,
} from './comment-thread';

type C = { id: string; text: string };
const c = (id: string): C => ({ id, text: id });
const thread = (...ids: string[]): CommentThreadOf<C> => ({
  comments: ids.map(c),
  resolved: false,
});
const ids = (t: CommentThreadOf<C> | undefined) => t?.comments.map((x) => x.id);

describe('threadWithComment', () => {
  it('starts a thread with the first comment', () => {
    expect(threadWithComment<C>(undefined, c('a'), 10)).toEqual(thread('a'));
  });

  it('appends, and reopens a resolved thread', () => {
    const resolved = { ...thread('a'), resolved: true };
    expect(threadWithComment(resolved, c('b'), 10)).toEqual(thread('a', 'b'));
  });

  it('hands back the same thread for a comment already there, or a full thread', () => {
    const t = thread('a', 'b');
    expect(threadWithComment(t, c('a'), 10)).toBe(t);
    expect(threadWithComment(t, c('z'), 2)).toBe(t);
  });

  it('puts a comment back ahead of `before`, or at the end when that one is gone', () => {
    expect(ids(threadWithComment(thread('a', 'c'), c('b'), 10, 'c'))).toEqual(['a', 'b', 'c']);
    expect(ids(threadWithComment(thread('a', 'c'), c('b'), 10, 'gone'))).toEqual(['a', 'c', 'b']);
  });
});

describe('threadWithoutComment', () => {
  it('takes a comment out, and the last one takes the thread with it', () => {
    expect(ids(threadWithoutComment(thread('a', 'b'), 'a'))).toEqual(['b']);
    expect(threadWithoutComment(thread('a'), 'a')).toBeUndefined();
  });

  it('hands back the same thread when the comment is not in it, and nothing for no thread', () => {
    const t = thread('a');
    expect(threadWithoutComment(t, 'z')).toBe(t);
    expect(threadWithoutComment(undefined, 'a')).toBeUndefined();
  });
});

describe('threadResolved', () => {
  it('resolves and reopens, keeping the comments', () => {
    const done = threadResolved(thread('a'), true);
    expect(done).toEqual({ comments: [c('a')], resolved: true });
    expect(threadResolved(done, false)).toEqual(thread('a'));
  });

  it('hands back the same thread when already so, and nothing for no thread', () => {
    const t = thread('a');
    expect(threadResolved(t, false)).toBe(t);
    expect(threadResolved(undefined, true)).toBeUndefined();
  });
});
