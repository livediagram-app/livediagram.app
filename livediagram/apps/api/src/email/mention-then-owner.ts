// A comment's mention emails, then the canvas owner's one email for it (comment-owner-email.ts): run by the canvas's
// room for the notify-mention route (document-room/room-rpc.ts).

import type { MentionNotice } from '../document-client';
import type { NoticeDocument } from '../liveworkspace/action-notices';
import type { DocumentEnv } from '../types';
import { notifyMentioned, notifyNewComment } from './notifications';

// The mention emails, then the owner's one email for the comment (email/comment-owner-email.ts): the comment's own
// path held the owner's new-comment email back because this mention covers it, so when the owner was mentioned and
// their mention email did not go (a refused claim, the author over the hourly cap), the new-comment email goes here.
// With the owner's notifyMentions off the comment's path already sent it, and its throttle keeps this a no-op.
export async function mentionThenOwner(
  env: DocumentEnv,
  document: NoticeDocument,
  input: MentionNotice,
): Promise<void> {
  const sent = await notifyMentioned(env, {
    ...input,
    document: { id: document.id, name: document.name },
  });
  const owner = input.recipients.find((p) => p.userId === document.ownerId);
  if (!owner || sent.includes(owner.id) || input.authorUserId === document.ownerId) return;
  await notifyNewComment(
    env,
    { id: document.id, ownerId: document.ownerId, name: document.name },
    input.authorName,
  );
}
