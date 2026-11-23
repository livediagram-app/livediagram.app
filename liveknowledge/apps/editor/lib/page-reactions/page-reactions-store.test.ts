import { describe, expect, it, vi } from 'vitest';
import type { PageReaction } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import {
  approvalFailureText,
  commentFailureText,
  reactionFailureText,
  watchFailureText,
} from '@/lib/knowledge/page-feedback-words';
import { createPageReactionsStore, type PageReactionsApi } from './page-reactions-store';
import {
  capsuleSplit,
  hasPageReaction,
  quickReactionName,
  reactionGroupsOf,
  withPageReaction,
} from './reaction-groups';

// docs/specs/030-knowledgebase/page-reactions.md "Live" and "Where they show": one read a page a session, the room's
// ops, a press shown at once and taken back on a refusal; the groups the capsule draws.
const who = { ownerId: 'user_me', shareCode: null };
const clap = (by: string, name = by): PageReaction => ({ emoji: '👏', by, name });
const heart = (by: string, name = by): PageReaction => ({ emoji: '❤️', by, name });

function store(list: PageReaction[] = [], change: PageReactionsApi['change'] = vi.fn()) {
  const api = { list: vi.fn(async () => list), change } as unknown as PageReactionsApi;
  return { s: createPageReactionsStore(api), api };
}

describe('the reactions store', () => {
  it('reads a page once, shares a read in flight, and reads again when asked fresh', async () => {
    const { s, api } = store([clap('a')]);
    expect(s.entryOf('d', 'p').status).toBe('loading');
    await Promise.all([s.load(who, 'd', 'p'), s.load(who, 'd', 'p')]);
    await s.load(who, 'd', 'p');
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(s.entryOf('d', 'p')).toEqual({ status: 'ready', reactions: [clap('a')] });
    await s.load(who, 'd', 'p', true);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('says a first read failed, and keeps what it held when a later one fails', async () => {
    const api = {
      list: vi.fn().mockRejectedValueOnce(new Error('x')),
      change: vi.fn(),
    } as unknown as PageReactionsApi;
    const s = createPageReactionsStore(api);
    await s.load(who, 'd', 'p');
    expect(s.entryOf('d', 'p').status).toBe('failed');
    (api.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([clap('a')]);
    await s.load(who, 'd', 'p');
    (api.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('y'));
    await s.load(who, 'd', 'p', true);
    expect(s.entryOf('d', 'p')).toEqual({ status: 'ready', reactions: [clap('a')] });
  });

  it("takes the room's ops for a page it has read, once each, and tells its listeners", async () => {
    const { s } = store([]);
    // A page not read here is left to its first read.
    s.receive('d', { kind: 'page-reaction', tabId: 'p', reaction: clap('a'), on: true });
    expect(s.entryOf('d', 'p').reactions).toEqual([]);
    await s.load(who, 'd', 'p');
    const heard = vi.fn();
    const off = s.subscribe(heard);
    const before = s.version();
    s.receive('d', { kind: 'page-reaction', tabId: 'p', reaction: clap('a'), on: true });
    s.receive('d', { kind: 'page-reaction', tabId: 'p', reaction: clap('a'), on: true });
    expect(s.entryOf('d', 'p').reactions).toEqual([clap('a')]);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(s.version()).toBe(before + 1);
    s.receive('d', { kind: 'page-reaction', tabId: 'p', reaction: clap('a'), on: false });
    expect(s.entryOf('d', 'p').reactions).toEqual([]);
    off();
  });

  it('shows a press at once, sends the name, and takes it back on a refusal', async () => {
    const change = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('no'));
    const { s } = store([], change);
    await s.load(who, 'd', 'p');
    const pending = s.toggle(who, 'd', 'p', clap('me', 'Ada'), true);
    expect(s.entryOf('d', 'p').reactions).toEqual([clap('me', 'Ada')]);
    await pending;
    expect(change).toHaveBeenCalledWith(who, 'd', 'p', { emoji: '👏', on: true, name: 'Ada' });
    await expect(s.toggle(who, 'd', 'p', heart('me', 'Ada'), true)).rejects.toThrow('no');
    expect(s.entryOf('d', 'p').reactions).toEqual([clap('me', 'Ada')]);
  });
});

describe('the groups the capsule draws', () => {
  it('groups by emoji in the order each was first used, marking yours', () => {
    const groups = reactionGroupsOf([clap('a', 'Ana'), heart('me', 'Me'), clap('me', 'Me')], 'me');
    expect(groups).toEqual([
      { emoji: '👏', count: 2, names: ['Ana', 'Me'], mine: true },
      { emoji: '❤️', count: 1, names: ['Me'], mine: true },
    ]);
    expect(reactionGroupsOf([clap('a')], null)[0]!.mine).toBe(false);
  });

  it('adds and takes away one reaction, keeping the same list when nothing moves', () => {
    const list = [clap('a')];
    expect(withPageReaction(list, clap('a'), true)).toBe(list);
    expect(withPageReaction(list, clap('b'), false)).toBe(list);
    expect(withPageReaction(list, clap('a'), false)).toEqual([]);
    expect(hasPageReaction(list, '👏', null)).toBe(false);
  });

  it('names the quick picks, and folds what does not fit into +N', () => {
    expect(quickReactionName('👏')).toBe('Clap');
    expect(quickReactionName('🚀')).toBeNull();
    expect(capsuleSplit([1, 2, 3], 5)).toEqual({ shown: [1, 2, 3], more: 0 });
    expect(capsuleSplit([1, 2, 3], 2)).toEqual({ shown: [1, 2], more: 1 });
  });
});

describe('a refused reaction, in words', () => {
  it('names each refusal, and says what failed otherwise', () => {
    expect(reactionFailureText(new ApiError('react to page', 429, 'reacting_too_fast'), true)).toBe(
      'That was a lot of reactions at once. Try again in a moment.',
    );
    expect(
      reactionFailureText(new ApiError('react to page', 403, 'reaction_needs_account'), true),
    ).toBe('Sign in to react to a page.');
    expect(reactionFailureText(new Error('x'), true)).toBe(
      'The reaction could not be added. Try again.',
    );
    expect(reactionFailureText(new ApiError('react to page', 500, 'other'), false)).toBe(
      'The reaction could not be taken back. Try again.',
    );
    // Named, so the toast still reads in the notification list.
    expect(reactionFailureText(new Error('x'), true, '“Onboarding”')).toBe(
      'The reaction to “Onboarding” could not be added. Try again.',
    );
    expect(reactionFailureText(new Error('x'), false, '“Onboarding”')).toBe(
      'The reaction to “Onboarding” could not be taken back. Try again.',
    );
  });

  it('names the page in a failed comment, watch or approval when it is given', () => {
    const down = new Error('x');
    expect(commentFailureText(down, 'start')).toBe('The comment could not be posted. Try again.');
    expect(commentFailureText(down, 'start', '“Onboarding”')).toBe(
      'The comment on “Onboarding” could not be posted. Try again.',
    );
    expect(commentFailureText(down, 'load', '“Onboarding”')).toBe(
      'The comments on “Onboarding” could not be loaded.',
    );
    expect(watchFailureText(down, true)).toBe('The page could not be watched. Try again.');
    expect(watchFailureText(down, false)).toBe('The watch could not be stopped. Try again.');
    expect(watchFailureText(down, true, '“Onboarding”')).toBe(
      '“Onboarding” could not be watched. Try again.',
    );
    expect(watchFailureText(down, false, '“Onboarding”')).toBe(
      'The watch on “Onboarding” could not be stopped. Try again.',
    );
    expect(approvalFailureText(down, 'approve')).toBe('The page could not be approved. Try again.');
    expect(approvalFailureText(down, 'request', '“Onboarding”')).toBe(
      'Approval of “Onboarding” could not be requested. Try again.',
    );
    expect(approvalFailureText(down, 'withdraw', '“Onboarding”')).toBe(
      'The request for “Onboarding” could not be withdrawn. Try again.',
    );
    expect(approvalFailureText(down, 'approve', '“Onboarding”')).toBe(
      '“Onboarding” could not be approved. Try again.',
    );
    expect(approvalFailureText(down, 'reject', '“Onboarding”')).toBe(
      '“Onboarding” could not be rejected. Try again.',
    );
  });
});
