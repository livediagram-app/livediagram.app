'use client';

// Settings > Account > Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting"): a catalogue of cloud providers, one row
// each, Google Drive the first. Every host (liveworkspace.app's panel, each app's Explorer and each editor) hands the
// panel the same thing: a Drive client over its own origin's `/api/drive` with the person's account token, where
// liveworkspace is, and how its Settings deep link names Account > Profile. The section is there only once the
// service says the deployment offers Drive (`GET /api/drive/config`), and only for a signed-in person: a host passes
// no host for a guest, and nothing is asked.
import { useEffect, useState } from 'react';
import {
  CLOUD_SYNC_SECTION,
  createDriveClient,
  DRIVE_HELP_PATH,
  type DriveClient,
} from '@liveworkspace/drive/client';
import type { DriveConfigAnswer } from '@liveworkspace/drive';
import type { SettingsRow } from '../model';
import { DRIVE_NOT_CONNECTED_TEXT } from './cloud-sync-copy';
import { GoogleDriveRow } from './GoogleDriveRow';

export type CloudSyncHost = {
  client: DriveClient;
  // liveworkspace's origin, whose /drive/connect every Connect leaves for.
  workspaceOrigin: string;
  // What `?settings=` names to reopen this host's Settings on Account > Profile: `profile` on liveworkspace.app's
  // Explorer, `account:account` in an editor.
  settingsParam: string;
  // The platform's help article on Drive sync, linked from the row.
  helpHref?: string;
};

/** An editor's host: the Drive service on its own origin (its router forwards `/api/drive`) with the person's token,
 *  and the platform's help article on liveworkspace. */
export function createCloudSyncHost({
  getToken,
  workspaceOrigin,
  settingsParam,
}: {
  getToken: () => string | null | Promise<string | null>;
  workspaceOrigin: string;
  settingsParam: string;
}): CloudSyncHost {
  const origin = workspaceOrigin.replace(/\/+$/, '');
  return {
    client: createDriveClient({ getToken }),
    workspaceOrigin: origin,
    settingsParam,
    helpHref: `${origin}${DRIVE_HELP_PATH}`,
  };
}

/** A host the service said offers Drive, with what it said. */
export type CloudSync = CloudSyncHost & { config: DriveConfigAnswer };

/** The provider rows, in order. Another provider (Dropbox, OneDrive) is another entry and its row. */
export const CLOUD_SYNC_PROVIDERS = [
  {
    id: 'googleDrive',
    label: 'Google Drive',
    keywords: 'drive google sync backup mirror cloud gdrive copy',
    description: DRIVE_NOT_CONNECTED_TEXT,
  },
] as const;

/** The host once its config is read and offers Drive; null before, for no host (a guest), and where it doesn't. Asked
 *  once per mount (each time Settings opens). */
export function useCloudSync(host: CloudSyncHost | null | undefined): CloudSync | null {
  // Kept whole, so the panel's model (which this feeds) keeps its identity across renders.
  const [answer, setAnswer] = useState<{ host: CloudSyncHost; cloudSync: CloudSync } | null>(null);
  useEffect(() => {
    if (!host) return;
    let live = true;
    void host.client.config().then((result) => {
      if (live && result.ok && result.data.enabled) {
        setAnswer({ host, cloudSync: { ...host, config: result.data } });
      }
    });
    return () => {
      live = false;
    };
  }, [host]);
  return answer && host && answer.host === host ? answer.cloudSync : null;
}

/** The Cloud Sync section's rows, filed under the Profile. */
export function cloudSyncRows(cloudSync: CloudSync): SettingsRow[] {
  return CLOUD_SYNC_PROVIDERS.map((provider) => ({
    kind: 'custom',
    key: provider.id,
    label: provider.label,
    description: provider.description,
    keywords: provider.keywords,
    section: CLOUD_SYNC_SECTION,
    render: () => <GoogleDriveRow cloudSync={cloudSync} />,
  }));
}
