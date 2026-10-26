// Drive's "Open with" (liveworkspace/docs/drive.md "Open with"), carried over from livediagram's open-with.ts to the
// server: what `<liveworkspace>/drive/open` should do with a file, and Import as a copy.
//
//   - open: the person reaches the item as their own, and the mirror records this file for it (or records none);
//   - import: a copy of a mirrored item, a file someone shared, or one from another environment;
//   - not ours: not a liveworkspace file;
//   - allow access: not connected, or the grant doesn't reach this file.

import {
  APP_NAMES,
  DRIVE_IMPORT_MAX_BYTES,
  DRIVE_PROP_APP,
  DRIVE_PROP_ITEM_ID,
  DRIVE_PROP_ORIGIN,
  formatOfKind,
  formatOfMime,
  isAppName,
  LOCAL_NAME_MAX,
  stripDriveName,
  APP_FILE_FORMATS,
  type AppName,
  type DriveImportAnswer,
  type DriveOpenAnswer,
} from '@liveworkspace/drive';
import { DriveApiError, DriveFileTooLarge, type DriveFile } from '@liveworkspace/drive/server';
import { APP_ITEMS } from '@liveworkspace/sites';
import { driveLog, driveWarn } from './log';
import type { Runtime } from './mirror/context';
import { NeedsReconnect, NotConnected } from './mirror/tokens';

export type OpenTarget = { fileId: string; resourceKey?: string };

// The app a file belongs to: its lwApp, else its MIME type, else its extension.
function appOfFile(file: DriveFile): AppName | null {
  const tagged = file.appProperties[DRIVE_PROP_APP];
  if (isAppName(tagged)) return tagged;
  const byMime = formatOfMime(file.mimeType);
  if (byMime) return byMime.app;
  const lower = file.name.toLowerCase();
  return APP_NAMES.find((app) => lower.endsWith(APP_FILE_FORMATS[app].extension)) ?? null;
}

const nameOf = (file: DriveFile, app: AppName) =>
  stripDriveName(file.name, LOCAL_NAME_MAX) ?? APP_ITEMS[app].noun;

// The file, or null when the grant doesn't reach it. A lapsed grant or a missing connection reads the same.
async function readFile(rt: Runtime, target: OpenTarget): Promise<DriveFile | null> {
  try {
    return await rt.drive.getFile(target.fileId, target.resourceKey);
  } catch (err) {
    if (err instanceof NeedsReconnect || err instanceof NotConnected) return null;
    if (err instanceof DriveApiError && (err.isNotFound || err.status === 403)) return null;
    throw err;
  }
}

export async function resolveOpen(rt: Runtime, target: OpenTarget): Promise<DriveOpenAnswer> {
  const file = await readFile(rt, target);
  if (!file) {
    driveLog('open-with', { outcome: 'allow_access' });
    return { action: 'allow_access' };
  }
  const app = appOfFile(file);
  const itemId = file.appProperties[DRIVE_PROP_ITEM_ID];
  if (!app) {
    driveLog('open-with', { outcome: 'not_ours' });
    return { action: 'not_ours' };
  }
  const name = nameOf(file, app);
  if (!itemId) return { action: 'import', app, name, reason: 'shared' };
  if (file.appProperties[DRIVE_PROP_ORIGIN] !== rt.deps.origin) {
    return { action: 'import', app, name, reason: 'other_environment' };
  }
  // A copy made in Drive carries the item's id, but the mirror records another file for it.
  const row = rt.deps.store.row('item', itemId);
  if (row && row.driveFileId !== file.id) {
    driveLog('open-with', { outcome: 'copy' });
    return { action: 'import', app, name, reason: 'copy' };
  }
  const own = await rt.index.ownItem(itemId);
  const url = own && isAppName(own.app) ? rt.doors.itemUrl(own.app, itemId) : null;
  if (!own || !url || !isAppName(own.app)) {
    driveLog('open-with', { outcome: 'shared' });
    return { action: 'import', app, name, reason: 'shared' };
  }
  driveLog('open-with', { outcome: 'open', id: itemId });
  return { action: 'open', app: own.app, itemId, url };
}

export type ImportOutcome =
  | DriveImportAnswer
  | {
      refused:
        'not_connected' | 'not_found' | 'invalid_request' | 'file_too_large' | 'google_failed';
    };

/** Import as a copy: the file's contents, checked to be an app's envelope, made a new item of the person's own
 *  through that app's import door. */
export async function importCopy(rt: Runtime, target: OpenTarget): Promise<ImportOutcome> {
  const file = await readFile(rt, target);
  if (!file) return { refused: 'not_found' };
  let text: string;
  try {
    // No bigger than an app's import door takes, read no further than that.
    text = await rt.drive.download(file.id, target.resourceKey, DRIVE_IMPORT_MAX_BYTES);
  } catch (err) {
    if (err instanceof DriveFileTooLarge) {
      driveWarn('import-refused', { fileId: file.id, reason: 'too_large' });
      return { refused: 'file_too_large' };
    }
    driveWarn('import-download-failed', {
      fileId: file.id,
      status: err instanceof DriveApiError ? err.status : 0,
    });
    return { refused: 'google_failed' };
  }
  let kind: unknown;
  try {
    kind = (JSON.parse(text) as { kind?: unknown }).kind;
  } catch {
    kind = null;
  }
  const format = formatOfKind(kind);
  if (!format) {
    driveWarn('import-refused', { fileId: file.id, reason: 'not_an_envelope' });
    return { refused: 'invalid_request' };
  }
  const { doors } = rt;
  const answer = await doors.importFile(format.app, {
    owner: rt.personId,
    folderId: null,
    name: nameOf(file, format.app),
    file: text,
  });
  if (!answer.ok) {
    driveWarn('import-refused', { fileId: file.id, reason: answer.error });
    return {
      refused:
        answer.error === 'failed' || answer.error === 'not_configured'
          ? 'google_failed'
          : answer.error === 'too_large'
            ? 'file_too_large'
            : 'invalid_request',
    };
  }
  const url = doors.itemUrl(format.app, answer.id);
  if (!url) return { refused: 'google_failed' };
  driveLog('open-with-imported', { fileId: file.id, id: answer.id, app: format.app });
  return { app: format.app, itemId: answer.id, url };
}
