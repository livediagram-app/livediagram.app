// Phone notifications from livedesign (docs/specs/014-identity/phone-notifications.md): which comment or assignment
// reaches whom, and the link a tap opens. The rules every app shares are @liveworkspace/index-app's createPusher; the
// sending is accounts' (sendPush). Every call here runs off the request's path and never throws into it.

import {
  createPusher,
  freshCommentsInThreads,
  type PushItem,
  type PushThread,
} from '@liveworkspace/index-app';
import { isAccountId, sendPush } from '@liveworkspace/auth-client';
import { MENTIONS_MAX, type Comment, type Element } from '@livedesign/design';
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
  async indexGrants(env, designId, personId) {
    const grant = await requestGrant(
      env,
      { kind: 'delegate', personId, teams: [] },
      designId,
      null,
    );
    // A link with a password still lets them in once they type it.
    return grant.ok || grant.error === 'password_required';
  },
});

const enc = encodeURIComponent;

// A notification tag: the design and the thread's place, in the characters accounts takes, at most 64.
export function pushTag(designId: string, place: string): string {
  return `${designId}:${place}`.replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 64);
}

/** The design's link, at nothing in particular. */
export function designUrl(env: Env, designId: string): string {
  return `${appBaseUrl(env)}/design/${enc(designId)}`;
}

// The editor's element deep link (live/lib/collab-deep-link.ts): the tab, the element, and the popover to open.
function elementLink(
  env: Env,
  designId: string,
  tabId: string,
  elementId: string,
  open: 'action' | 'comments',
): string {
  return `${designUrl(env, designId)}#t=${enc(tabId)}&el=${enc(elementId)}&open=${open}`;
}

/** The link to an element's comment thread. */
export function elementThreadUrl(
  env: Env,
  designId: string,
  tabId: string,
  elementId: string,
): string {
  return elementLink(env, designId, tabId, elementId, 'comments');
}

/** The link to an element's assigned action. */
export function elementUrl(env: Env, designId: string, tabId: string, elementId: string): string {
  return elementLink(env, designId, tabId, elementId, 'action');
}

// A tab's threads as the pusher reads them, each placed at its element.
function threadsOf(elements: readonly Element[]): PushThread<Comment>[] {
  return elements.flatMap((el) => {
    const thread = commentThreadOf(el);
    return thread ? [{ at: el.id, comments: thread.comments ?? [] }] : [];
  });
}

/**
 * A save, a changeset or a REST comment wrote a tab: each comment it adds that the writer wrote (at most a handful)
 * notifies the people it mentions, who wrote earlier in its thread, and the design's owner. A signed-in person's
 * write only: the caller leaves out an API token's.
 */
export async function pushNewComments(
  env: Env,
  input: {
    design: PushItem;
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
      item: input.design,
      authorId: input.authorId,
      authorName: input.authorName,
      threadAuthorIds,
      mentions: comment.mentions,
      mentionsMax: MENTIONS_MAX,
      url: elementThreadUrl(env, input.design.id, input.tabId, at),
      tag: pushTag(input.design.id, at),
    });
  }
}

/** A design as the pusher reads it. */
export const pushItemOf = (design: {
  id: string;
  name: string;
  ownerId: string;
  teamId?: string | null;
}): PushItem => ({
  id: design.id,
  name: design.name,
  ownerId: design.ownerId,
  teamId: design.teamId ?? null,
});
