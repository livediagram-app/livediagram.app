// The Drive service as this site's pages call it (liveworkspace/docs/specs/005-drive/drive.md "The service"): `/api/drive` on this
// origin, liveworkspace.app or an app's router, with the person's account token. A guest's token is never
// sent: the service refuses it, so a guest's page asks nothing.
import { createDriveClient, DRIVE_HELP_PATH } from '@liveworkspace/drive/client';
import type { ExplorerDriveHost } from '@liveworkspace/explorer';
import type { CloudSyncHost } from '@liveworkspace/settings-ui';
import { workspaceOrigin } from '../explorer/page-app';
import { workspaceIdentity } from '../explorer/token';

export const driveClient = createDriveClient({
  getToken: async () => {
    const identity = await workspaceIdentity();
    return identity?.kind === 'account' ? identity.token : null;
  },
});

/** How the Explorer's `?settings=` names Account > Profile (lib/explorer/host.ts settingsOpening), for Cloud Sync's way
 *  back from Google. */
export const DRIVE_SETTINGS_PARAM = 'profile';

/** The Explorer's Drive marks, for a signed-in person. */
export const explorerDrive = (): ExplorerDriveHost => ({
  client: driveClient,
  workspaceOrigin: workspaceOrigin(),
});

/** Settings' Cloud Sync, for a signed-in person, with the platform's help article (/help/google-drive). */
export const cloudSyncHost = (): CloudSyncHost => ({
  client: driveClient,
  workspaceOrigin: workspaceOrigin(),
  settingsParam: DRIVE_SETTINGS_PARAM,
  helpHref: `${workspaceOrigin()}${DRIVE_HELP_PATH}`,
});
