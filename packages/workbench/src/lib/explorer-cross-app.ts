'use client';

// Another app's API from this app's Inbox (liveworkspace/docs/specs/004-index/inbox-reading.md "Cross-app verbs"): the
// person's workspace token, traded for this app's bearer at the accounts' bearer door through this app's router
// (`/api/workspace/account/workspace-token`), so Reply and Resolve work on any app's thread. One source per page.

import type { App } from '@liveworkspace/index-client';
import type { InboxApi } from '@liveworkspace/explorer/inbox-actions';
import {
  createWorkspaceTokenSource,
  crossAppInboxApi,
} from '@liveworkspace/explorer/inbox-cross-app';
import { workbench } from '../bindings';

const workspaceToken = createWorkspaceTokenSource({
  url: '/api/workspace/account/workspace-token',
  bearer: () => workbench.api.currentBearer(),
});

/** `app`'s API as the person, for this app's Inbox verbs on that app's rows. */
export const explorerCrossAppApi = (app: App): InboxApi => crossAppInboxApi(app, workspaceToken);
