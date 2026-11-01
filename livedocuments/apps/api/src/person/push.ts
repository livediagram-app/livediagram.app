// Phone notifications from livedocuments (docs/specs/014-identity/phone-notifications.md): which comment or
// assignment reaches whom, and the link a tap opens. The rules every app shares are @liveworkspace/index-app's
// createPusher; the sending is accounts' (sendPush). Every call here runs off the request's path and never throws
// into it.

import {
  createPusher,
  freshCommentsInThreads,
  type PushItem,
  type PushThread,
} from '@liveworkspace/index-app';
import { isAccountId, sendPush } from '@liveworkspace/auth-client';
import { MENTIONS_MAX, type Comment, type Element } from '@livedocuments/document';
import { accountCredentials } from '../auth/accounts';
import { commentThreadOf } from '../comments';
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

// A notification tag: the document and the thread's place, in the characters accounts takes, at most 64.
export function pushTag(documentId: string, place: string): string {
  return `${documentId}:${place}`.replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 64);
}

/** The document itself, with no place in it. */
export function documentUrl(env: Env, documentId: string): string {
  return `${appBaseUrl(env)}/document/${enc(documentId)}`;
}

/** The link to an element's thread (the editor's deep link, apps/editor/lib/collab-deep-link.ts). */
export function elementThreadUrl(
  env: Env,
  documentId: string,
  tabId: string,
  elementId: string,
): string {
  return `${documentUrl(env, documentId)}#t=${enc(tabId)}&el=${enc(elementId)}&open=comments`;
}

/** The link to a tab's element (an assigned action). */
export function elementUrl(env: Env, documentId: string, tabId: string, elementId: string): string {
  return `${documentUrl(env, documentId)}#t=${enc(tabId)}&el=${enc(elementId)}&open=action`;
}

// A tab's threads as the pusher reads them: one an element, placed at it.
function threadsOf(elements: readonly Element[]): PushThread<Comment>[] {
  return elements.map((el) => ({ at: el.id, comments: commentThreadOf(el)?.comments ?? [] }));
}

/**
 * A save, a changeset or a comment route wrote a tab: each comment it adds that the writer wrote (at most a
 * handful) notifies the people it mentions, who wrote earlier in its thread, and the document's owner. A signed-in
 * person's write only: the caller leaves out an API token's.
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

/** A document as the pusher reads it. */
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
