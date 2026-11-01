// Phone notifications from livehuddle (docs/specs/014-identity/phone-notifications.md): which comment or assignment
// reaches whom, and the link a tap opens. The rules every app shares are @liveworkspace/index-app's createPusher; the
// sending is accounts' (sendPush). Every call here runs off the request's path and never throws into it.

import {
  createPusher,
  freshCommentsInThreads,
  type PushItem,
  type PushThread,
} from '@liveworkspace/index-app';
import { isAccountId, sendPush } from '@liveworkspace/auth-client';
import { MENTIONS_MAX, type Comment, type CommentThread, type Element } from '@livehuddle/document';
import { accountCredentials } from '../auth/accounts';
import { appBaseUrl } from '../email/client';
import { requestGrant } from '../index-service';
import type { Env } from '../types';
import { teamPeople } from './team-people';

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
  async indexGrants(env, documentId, personId) {
    const grant = await requestGrant(
      env,
      { kind: 'delegate', personId, teams: [] },
      documentId,
      null,
    );
    // A link with a password still lets them in once they type it.
    return grant.ok || grant.error === 'password_required';
  },
});

const enc = encodeURIComponent;

// A notification tag: the canvas and the thread's place, in the characters accounts takes, at most 64.
export function pushTag(documentId: string, place: string): string {
  return `${documentId}:${place}`.replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 64);
}

/** The canvas's own link: an action with no place given. */
export function documentUrl(env: Env, documentId: string): string {
  return `${appBaseUrl(env)}/document/${enc(documentId)}`;
}

/** The link to an element's comment thread (the editor's deep link, lib/collab-deep-link.ts). */
export function elementThreadUrl(
  env: Env,
  documentId: string,
  tabId: string,
  elementId: string,
): string {
  return `${documentUrl(env, documentId)}#t=${enc(tabId)}&el=${enc(elementId)}&open=comments`;
}

/** The link to an element's assigned action. */
export function elementActionUrl(
  env: Env,
  documentId: string,
  tabId: string,
  elementId: string,
): string {
  return `${documentUrl(env, documentId)}#t=${enc(tabId)}&el=${enc(elementId)}&open=action`;
}

// A tab's threads as the pusher reads them, each placed at its element.
function threadsOf(elements: readonly Element[]): PushThread<Comment>[] {
  const out: PushThread<Comment>[] = [];
  for (const el of elements) {
    const thread = (el as { commentThread?: CommentThread }).commentThread;
    if (thread?.comments?.length) out.push({ at: el.id, comments: thread.comments });
  }
  return out;
}

/**
 * A save, a changeset or a REST comment wrote a tab: each comment it adds that the writer wrote (at most a handful)
 * notifies the people it mentions, who wrote earlier in its thread, and the canvas's owner. A signed-in person's
 * write only: the caller leaves out an API token's.
 */
export async function pushNewComments(
  env: Env,
  input: {
    document: PushItem;
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
      item: input.document,
      authorId: input.authorId,
      authorName: input.authorName,
      threadAuthorIds,
      mentions: comment.mentions,
      mentionsMax: MENTIONS_MAX,
      url: elementThreadUrl(env, input.document.id, input.tabId, at),
      tag: pushTag(input.document.id, at),
    });
  }
}

/** A canvas as the pusher reads it. */
export const pushItemOf = (document: {
  id: string;
  name: string;
  ownerId: string;
  teamId?: string | null;
}): PushItem => ({
  id: document.id,
  name: document.name,
  ownerId: document.ownerId,
  teamId: document.teamId ?? null,
});
