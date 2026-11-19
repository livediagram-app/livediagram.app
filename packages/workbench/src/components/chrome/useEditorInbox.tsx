'use client';

// The editor's door to Inbox notices (liveworkspace/docs/specs/004-index/inbox-notices.md "Who sees them, and where"):
// each editor's Explorer button calls it with its app. On for a signed-in account in an app with an Inbox, off for a
// guest (their own moves can't be told from anyone else's) and for livehuddle. The rows are the reader's own Inbox,
// read through this site's index client; the notice links and the count come from @liveworkspace/explorer's small
// inbox-notices entry, so the editor's first load carries none of the Explorer.

import type { ReactNode } from 'react';
import type { App } from '@liveworkspace/index-client';
import {
  InboxCountBadge,
  inboxButtonLabel,
  useInboxNotices,
  type InboxNoticeEvent,
} from '@liveworkspace/explorer/inbox-notices';
import { workbench } from '../../bindings';
import { indexClient } from '../../lib/index-client';
import { useDeferredAuth, type DeferredAuthState } from '../providers/deferred-auth';

export type EditorInbox = {
  /** The Inbox's count, undefined until read or for a guest. */
  count: number | undefined;
  /** The Explorer button's name with the count ("Explorer, 3 in Inbox"). */
  label: (name: string) => string;
  /** The count's badge, to draw inside the (relative) Explorer button. */
  badge: ReactNode;
  /** The notice layer, to draw beside the button. */
  notices: ReactNode;
};

// The name a teammate's `@handle` for this person is made from (model-core's assignHandles): their profile name.
const displayName = (user: DeferredAuthState['user']): string | null =>
  user?.fullName?.trim() ||
  [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
  user?.username ||
  null;

const track = (event: InboxNoticeEvent) => workbench.track('UI', event, 'InboxNotice');

export function useEditorInbox(
  app: App,
  { enabled = true }: { enabled?: boolean } = {},
): EditorInbox {
  const { isSignedIn, userId, user } = useDeferredAuth();
  const { count, notices } = useInboxNotices({
    client: indexClient,
    app,
    viewerId: isSignedIn ? userId : null,
    viewerName: displayName(user),
    enabled,
    onTelemetry: track,
  });
  return {
    count,
    label: (name) => inboxButtonLabel(name, count),
    badge: <InboxCountBadge count={count} />,
    notices,
  };
}
