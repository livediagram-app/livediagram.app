// Closing a liveworkspace account, asked for by an app's own server when the person deletes their
// account there. The app sends its client credentials and the person's access token, both checked
// (app-caller.ts), and the code emailed to the person (deletion-code.ts): being signed in is not
// enough, so an account left signed in on a shared machine can't be closed by whoever sits down at it.
//
// Deleting the user takes everything else with it: sessions and linked Google accounts through
// Better Auth, and the OAuth tokens and consents through their foreign keys; teams, settings and
// the profile are cleared first, explicitly. Every app's refresh token stops working at once; an access token
// already issued runs out on its own (minutes). Then the index is told to purge everything it holds
// for the person (index-purge.ts): recorded before the user goes, so it can't be lost, and sent again
// by the cron if the index doesn't take it now. Its workbench goes last: pairings, sessions and the rooms they had
// open (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access"), and its Google Drive mirror is disconnected, its files left in
// Drive (liveworkspace/docs/specs/005-drive/drive.md). The account is closed either way.
import { introspectCaller, type CallerConfig } from './app-caller.ts';
import { checkDeletionCode, underCheckLimit } from './deletion-code.ts';
import { purgeFromIndex, recordPendingPurge, type IndexPurgeConfig } from './index-purge.ts';
import { deleteProfile } from './profiles.ts';
import { deleteSettings } from './settings.ts';
import { leaveAllTeams } from './teams.ts';

export const DELETE_ACCOUNT_PATH = '/delete-account';

export interface DeleteAccountConfig extends CallerConfig {
  index?: IndexPurgeConfig;
  // The account's workbench: its store dropped and its rooms closed (workbench/revoke.ts). Never fails the close.
  closeWorkbench?: (userId: string) => Promise<void>;
  // The account's Google Drive mirror: disconnected by the Drive service (drive-disconnect.ts). Never fails the close.
  disconnectDrive?: (userId: string) => void;
  // The account's Download Your Data zip, deleted by the export service (data-export/routes.ts). Never fails the close.
  removeExport?: (userId: string) => void;
  // Tries at the code, per account (deletion-code.ts).
  checkLimiter?: RateLimit;
}

export async function deleteAccount(
  request: Request,
  db: D1Database,
  config: DeleteAccountConfig,
): Promise<Response> {
  const caller = await introspectCaller(request, config);
  if (!caller.ok) return caller.response;
  const userId = caller.userId;

  if (!(await underCheckLimit(config.checkLimiter, userId))) {
    return Response.json({ error: 'rate_limited' }, { status: 429 });
  }
  const checked = await checkDeletionCode(db, userId, String(caller.body.code ?? ''), {
    spend: true,
  });
  if (checked !== 'ok') return Response.json({ error: checked }, { status: 403 });

  // Teams first, so the apps hear that the account left each one and a team it ran passes on.
  const closedTeams = await leaveAllTeams(db, userId);
  // Settings and the profile have no foreign key to the account (a guest's rows have no account), so
  // they go here.
  await deleteSettings(db, userId);
  await deleteProfile(db, userId);
  await recordPendingPurge(db, userId, closedTeams);
  const ctx = await config.auth.$context;
  await ctx.internalAdapter.deleteUser(userId);
  // A failure is logged and left for the cron; it never keeps the account open.
  await purgeFromIndex(db, config.index ?? {}, userId);
  await config.closeWorkbench?.(userId);
  config.disconnectDrive?.(userId);
  config.removeExport?.(userId);
  return Response.json({ deleted: true });
}
