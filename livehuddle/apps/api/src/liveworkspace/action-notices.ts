// What an assigned action sends, from inside the canvas's Durable Object (document-room.ts notifyAction): the
// assignee's phone notification when they have an account and can open the canvas, and the email unless the dialog's
// Email box was unticked (docs/specs/012-collaboration/assigned-actions.md "The email",
// docs/specs/014-identity/phone-notifications.md). Each is a promise for the room's waitUntil; neither rejects.

import type { ActionNotice } from '../document-client';
import { notifyActionAssigned } from '../email/notifications';
import type { DocumentEnv } from '../types';
import { pusher, pushItemOf } from './push';

export type NoticeDocument = { id: string; name: string; ownerId: string; teamId: string | null };

export function actionNotices(
  env: DocumentEnv,
  document: NoticeDocument,
  input: ActionNotice,
): Promise<void>[] {
  const { email = true, push, ...notice } = input;
  const work: Promise<void>[] = [];
  if (push && notice.assigneeCanOpen && notice.assignee.userId)
    work.push(
      pusher.pushActionAssigned(env, {
        item: pushItemOf(document),
        assignerId: notice.assignerUserId,
        assignerName: notice.assignerName,
        assigneeUserId: notice.assignee.userId,
        url: push.url,
        tag: push.tag,
      }),
    );
  if (email)
    work.push(
      notifyActionAssigned(env, {
        ...notice,
        document: { id: document.id, name: document.name },
      }).catch(() => {}),
    );
  return work;
}
