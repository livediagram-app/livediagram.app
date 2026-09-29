// "Open with" on a copy of a mirrored file: **Import as new document**
// (docs/specs/022-drive-mirror/drive-mirror.md, "Copies made in Drive"; blueprint
// "Open with"). The copy carries the original's ldDiagramId, but it is another
// Drive file, so it never opens, re-tags or adopts the original.

import {
  DRIVE_PROP_DIAGRAM_ID,
  DRIVE_PROP_ORIGIN,
  stripDriveName,
  type DriveItem,
} from '@livediagram/api-schema';
import type { DiagramEnvelope } from '../export-diagram-text';
import { DriveApiError, type DriveClient, type DriveFile } from './drive-client';
import type { LivediagramPort } from './livediagram-port';
import { driveLog, driveWarn } from './log';
import { LD_NAME_MAX } from './plan-inbound';
import { fileState } from './snapshot';

export type CopyPort = Pick<
  LivediagramPort,
  'importDiagramCopy' | 'getConnection' | 'listItems' | 'listPersonalFolders' | 'putItems'
>;

type Placement = { folderId: string | null; unseen: boolean };

// Where the new document goes: the livediagram folder the copy's Drive folder
// mirrors; Unsorted for the root; Unsorted with the unseen-folder notice for a
// folder livediagram cannot see.
async function placeCopy(port: CopyPort, parentId: string | null): Promise<Placement> {
  const [connection, items, folders] = await Promise.all([
    port.getConnection(),
    port.listItems(),
    port.listPersonalFolders(),
  ]);
  if (parentId !== null && parentId === connection?.rootFolderId)
    return { folderId: null, unseen: false };
  const item = items.find((i) => i.kind === 'folder' && i.driveFileId === parentId);
  if (item && folders.some((f) => f.id === item.ldId))
    return { folderId: item.ldId, unseen: false };
  return { folderId: null, unseen: true };
}

// What the copy becomes after the import: the current rule, pending the
// operator's confirmation, and the only place it lives. A copy the user owns is
// re-tagged with the new document's id and recorded, so it mirrors that document
// and no second file is made for it. Someone else's copy is left as it is.
async function claimCopy(
  deps: { drive: DriveClient; port: CopyPort; host: string },
  file: DriveFile,
  claim: { newId: string; name: string; placement: Placement },
): Promise<void> {
  if (!file.ownedByMe || file.trashed) {
    driveLog('open-with-unclaimed', { owned: file.ownedByMe, trashed: file.trashed });
    return;
  }
  try {
    const updated = await deps.drive.updateFile(file.id, {
      appProperties: { [DRIVE_PROP_DIAGRAM_ID]: claim.newId, [DRIVE_PROP_ORIGIN]: deps.host },
    });
    const unseen = claim.placement.unseen;
    const item: DriveItem = {
      kind: 'diagram',
      ldId: claim.newId,
      driveFileId: file.id,
      ...fileState(updated),
      ldName: claim.name,
      // Outbound then writes the new document's contents into the copy.
      mirroredSavedAt: null,
      notice: unseen ? 'unseen_folder' : null,
      noticeParentId: unseen ? (file.parents[0] ?? null) : null,
    };
    await deps.port.putItems([item]);
    driveLog('open-with-claimed', { unseen });
  } catch (err) {
    // The new document still opens; the copy stays a foreign copy, ignored
    // inbound, and outbound gives the new document its own file.
    driveWarn('open-with-claim-failed', {
      status: err instanceof DriveApiError ? err.status : null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function importAsNewDocument(
  deps: { drive: DriveClient; port: CopyPort; host: string },
  file: DriveFile,
  envelope: DiagramEnvelope,
): Promise<string> {
  // Created before the item is recorded: outbound bins the file of an item
  // whose diagram is missing.
  const placement = await placeCopy(deps.port, file.parents[0] ?? null);
  const name = stripDriveName(file.name, LD_NAME_MAX) ?? envelope.diagram.name;
  const newId = await deps.port.importDiagramCopy(envelope, {
    id: crypto.randomUUID(),
    name,
    folderId: placement.folderId,
  });
  driveLog('open-with-imported-copy', { unseen: placement.unseen });
  await claimCopy(deps, file, { newId, name, placement });
  return newId;
}
