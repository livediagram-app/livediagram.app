// One comment, one email for the canvas's owner (docs/specs/014-identity/transactional-email.md #3, and
// docs/specs/012-collaboration/comment-mentions.md "The email"). A comment that @-mentions the owner would reach
// them twice: the owner's new-comment email on the comment's own path (the tab save, the comment routes, a
// changeset), and the mention email on the notify-mention route. The mention email quotes the comment, so it is the
// one that goes: the comment's path holds the owner email back when the mention email will cover it, and the mention
// route sends the owner email after all when the owner's mention email did not go (a refused claim, the hourly cap).

import type { CommentMention } from '@livediagram/document';
import { notifyRecipients } from '../liveworkspace/notify';
import type { Env } from '../types';

export type MentionedComment = { mentions?: readonly CommentMention[] };

/** Whether every one of these new comments @-mentions `ownerId`. None at all is false: nothing to cover. */
export function everyMentionsOwner(
  comments: readonly MentionedComment[],
  ownerId: string,
): boolean {
  return (
    comments.length > 0 &&
    comments.every((c) => c.mentions?.some((m) => m.userId === ownerId) === true)
  );
}

/** Whether the owner's mention email covers these new comments, so their new-comment email is not sent: each one
 *  mentions the owner, the canvas is a team's (a mention is only ever of the canvas's own team), and the owner has
 *  "Someone Mentions Me in a Comment" on (`notifyMentions`), checked only when the rest holds. */
export async function ownerEmailCoveredByMention(
  env: Env,
  document: { ownerId: string; teamId?: string | null },
  comments: readonly MentionedComment[],
): Promise<boolean> {
  if (!document.teamId || !everyMentionsOwner(comments, document.ownerId)) return false;
  const reachable = await notifyRecipients(env, [document.ownerId], 'notifyMentions');
  return reachable.has(document.ownerId);
}
