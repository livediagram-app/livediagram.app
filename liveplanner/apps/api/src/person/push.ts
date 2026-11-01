// Phone notifications from liveplanner (docs/specs/014-identity/phone-notifications.md): which comment or assignment
// reaches whom, and the link a tap opens. The rules every app shares are @liveworkspace/index-app's createPusher; the
// sending is accounts' (sendPush). Every call here runs off the request's path and never throws into it.

import {
  createPusher,
  freshCommentsInThreads,
  type PushItem,
  type PushThread,
} from '@liveworkspace/index-app';
import { isAccountId, sendPush } from '@liveworkspace/auth-client';
import {
  elementThreads,
  MENTIONS_MAX,
  type Comment,
  type CommentThread,
  type Element,
} from '@liveplanner/project';
import { accountCredentials } from '../auth/accounts';
import { appBaseUrl } from '../email/client';
import { requestGrant } from '../index-service';
import type { Env } from '../types';
import { teamPeople } from './notify';

export const pusher = createPusher<Env>({
  async send(env, notifications) {
    const credentials = accountCredentials(env);
    if (!credentials) return;
    try {
      await sendPush(credentials, notifications);
    } catch (error) {
      console.warn('[push] send_failed', { error: String(error) });
    }
  },
  isAccount: isAccountId,
  teamPeople,
  async indexGrants(env, planId, personId) {
    const grant = await requestGrant(env, { kind: 'delegate', personId, teams: [] }, planId, null);
    // A link with a password still lets them in once they type it.
    return grant.ok || grant.error === 'password_required';
  },
});

const enc = encodeURIComponent;

// A notification tag: the plan and the thread's place, in the characters accounts takes, at most 64.
export function pushTag(planId: string, place: string): string {
  return `${planId}:${place}`.replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 64);
}

/** The link to a thread on a tab's element (a Sheet cell's thread opens its sheet's comments). */
export function elementThreadUrl(
  env: Env,
  planId: string,
  tabId: string,
  elementId: string,
): string {
  return `${appBaseUrl(env)}/project/${enc(planId)}#t=${enc(tabId)}&el=${enc(elementId)}&open=comments`;
}

/** The link to a card's thread, whichever board shows the card. */
export function cardThreadUrl(env: Env, planId: string, cardId: string, threadId: string): string {
  return `${appBaseUrl(env)}/project/${enc(planId)}#item=${enc(cardId)}&thread=${enc(threadId)}`;
}

/** The link to a tab's element (an assigned action). */
export function elementUrl(env: Env, planId: string, tabId: string, elementId: string): string {
  return `${appBaseUrl(env)}/project/${enc(planId)}#t=${enc(tabId)}&el=${enc(elementId)}&open=action`;
}

// A tab's threads as the pusher reads them, each placed at its element.
function threadsOf(elements: readonly Element[]): PushThread<Comment>[] {
  return elements.flatMap((el) =>
    elementThreads(el).map(({ thread }) => ({
      at: el.id,
      comments: (thread as CommentThread | undefined)?.comments ?? [],
    })),
  );
}

/**
 * A save or a changeset wrote a tab: each comment it adds that the writer wrote (at most a handful) notifies the
 * people it mentions, who wrote earlier in its thread, and the plan's owner. A signed-in person's save only: the
 * caller leaves out an API token's.
 */
export async function pushNewComments(
  env: Env,
  input: {
    plan: PushItem;
    tabId: string;
    authorId: string;
    authorName: string | null;
    next: readonly Element[];
    previous: readonly Element[];
  },
): Promise<void> {
  if (!isAccountId(input.authorId)) return;
  const fresh = freshCommentsInThreads(
    threadsOf(input.next),
    threadsOf(input.previous),
    input.authorId,
  );
  for (const { at, comment, threadAuthorIds } of fresh) {
    await pusher.pushComment(env, {
      item: input.plan,
      authorId: input.authorId,
      authorName: input.authorName,
      threadAuthorIds,
      mentions: comment.mentions,
      mentionsMax: MENTIONS_MAX,
      url: elementThreadUrl(env, input.plan.id, input.tabId, at),
      tag: pushTag(input.plan.id, at),
    });
  }
}

/**
 * A comment posted in a card's thread (started or replied to): the people it mentions, who wrote earlier in the
 * thread, and the plan's owner. A signed-in person's only.
 */
export async function pushCardComment(
  env: Env,
  input: {
    plan: PushItem;
    comment: Comment;
    cardId: string;
    threadId: string;
    // The thread's comments as they stand after this one; empty for a thread it starts.
    thread: readonly Comment[];
  },
): Promise<void> {
  const { comment } = input;
  if (!comment.authorId || !isAccountId(comment.authorId)) return;
  const earlier = input.thread.filter((c) => c.id !== comment.id).map((c) => c.authorId);
  await pusher.pushComment(env, {
    item: input.plan,
    authorId: comment.authorId,
    authorName: comment.authorName ?? null,
    threadAuthorIds: [...new Set(earlier.filter((id): id is string => !!id))],
    mentions: comment.mentions,
    mentionsMax: MENTIONS_MAX,
    url: cardThreadUrl(env, input.plan.id, input.cardId, input.threadId),
    tag: pushTag(input.plan.id, input.threadId),
  });
}

/** A plan as the pusher reads it. */
export const pushItemOf = (plan: {
  id: string;
  name: string;
  ownerId: string;
  teamId?: string | null;
}): PushItem => ({
  id: plan.id,
  name: plan.name,
  ownerId: plan.ownerId,
  teamId: plan.teamId ?? null,
});
