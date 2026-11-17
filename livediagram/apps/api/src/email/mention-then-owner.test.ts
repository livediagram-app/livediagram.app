import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TeamPerson } from '@liveworkspace/auth-client';
import type { DocumentEnv } from '../types';

vi.mock('./notifications', () => ({ notifyMentioned: vi.fn(), notifyNewComment: vi.fn() }));

import { mentionThenOwner } from './mention-then-owner';
import { notifyMentioned, notifyNewComment } from './notifications';

// One comment, one email for the owner (comment-owner-email.ts): the comment's path held the owner email back for a
// mention of the owner, so when that mention email does not go (a refused claim, the hourly cap), it goes here.
const env = {} as DocumentEnv;
const document = { id: 'd1', name: 'Roadmap', ownerId: 'user_owner', teamId: 'team-1' };
const person = (id: string, userId: string | null) => ({ id, userId }) as unknown as TeamPerson;
const owner = person('m-1', 'user_owner');
const priya = person('m-2', 'user_priya');
const input = (recipients: TeamPerson[], authorUserId = 'user_anna') => ({
  recipients,
  authorUserId,
  authorName: 'Anna',
  commentText: 'Look, @owner',
});

afterEach(() => vi.resetAllMocks());

describe('mentionThenOwner', () => {
  it('sends only the mention email when it reached the owner', async () => {
    vi.mocked(notifyMentioned).mockResolvedValue(['m-1', 'm-2']);
    await mentionThenOwner(env, document, input([owner, priya]));
    expect(notifyMentioned).toHaveBeenCalledWith(env, {
      ...input([owner, priya]),
      document: { id: 'd1', name: 'Roadmap' },
    });
    expect(notifyNewComment).not.toHaveBeenCalled();
  });

  it('sends the owner email instead when the owner’s mention email was refused or capped', async () => {
    vi.mocked(notifyMentioned).mockResolvedValue(['m-2']);
    await mentionThenOwner(env, document, input([owner, priya]));
    expect(notifyNewComment).toHaveBeenCalledWith(
      env,
      { id: 'd1', ownerId: 'user_owner', name: 'Roadmap' },
      'Anna',
    );
  });

  it('leaves the owner alone when they were not mentioned, or wrote the comment', async () => {
    vi.mocked(notifyMentioned).mockResolvedValue([]);
    await mentionThenOwner(env, document, input([priya]));
    await mentionThenOwner(env, document, input([owner], 'user_owner'));
    expect(notifyNewComment).not.toHaveBeenCalled();
  });
});
