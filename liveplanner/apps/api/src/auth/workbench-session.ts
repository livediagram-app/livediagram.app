// The `lvw_` bearer (docs/specs/013-workspace/blueprints/workbench-embeds.md "A request bearing lvw_"). Sessions are
// liveworkspace's (liveworkspace/docs/specs/011-workbench/workbench.md): this api asks accounts about each one with its
// client credentials and keeps the answer per isolate, through @liveworkspace/auth-client's workbench-sessions.ts.
// This hands in liveplanner's credentials, what a session reaches in its names, and the outage error.

import { createWorkbenchSessions } from '@liveworkspace/auth-client/workbench-sessions';
import { AccountsUnavailable } from '../db/api-tokens';
import { accountCredentials } from './accounts';

export { sessionPrefixOf } from '@liveworkspace/auth-client/workbench-sessions';

// What a session reaches, as this api names it: one plan, or the workspace from an optional folder.
export type WorkbenchReach =
  | { scope: 'project'; projectId: string; folderId: null }
  | { scope: 'workspace'; projectId: null; folderId: string | null };

export const { resolveWorkbenchSession, noteWorkbenchRoom } = createWorkbenchSessions({
  // Read at call time, so a test's mock of ./accounts is the one asked.
  credentials: (env: Parameters<typeof accountCredentials>[0]) => accountCredentials(env),
  reach: (s): WorkbenchReach =>
    s.scope === 'item'
      ? { scope: 'project', projectId: s.itemId!, folderId: null }
      : { scope: 'workspace', projectId: null, folderId: s.folderId },
  unavailable: () => new AccountsUnavailable(),
});
