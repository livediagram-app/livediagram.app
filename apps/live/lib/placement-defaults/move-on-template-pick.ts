// Applying a template's default folder when the template is picked after creation
// (docs/specs/013-workspace/default-folders.md "A template picked after creation"). Loaded only at the pick (the
// editor imports it dynamically): it reads the template's intent, the document's place, the person's defaults and the
// folders they can see, then moves the document when a default answers somewhere else. Every failure leaves the
// document where it is: being unable to apply a default is no reason to disturb the work.
import { creationIntentOf, type PlacementDefaultKey } from '@livediagram/api-schema';
import { templateFamilyOf, type TemplateKind } from '@livediagram/templates';
import {
  apiGetTeamLibrary,
  apiListFolders,
  apiListTeams,
  apiLoadDocument,
  apiSetDocumentFolder,
} from '@/lib/api-client';
import { apiListPlacementDefaults } from '@/lib/api/placement-defaults';
import { debugLog } from '@/lib/debug-log';
import { isOfflineId } from '@/lib/offline/offline-store';
import { buildTemplatedTab } from '@/lib/template-builders';
import { buildDefaultFolderIndex } from './default-destination';
import { defaultKeyEntry } from './default-key-entries';
import type { TemplatePickHandoff } from './template-pick-handoff';
import { templatePickMoveTarget } from './template-pick-move';

/** The toast's words for a move: "Moved to Boards, your default folder for Kanban boards." */
function movedMessage(folderName: string, key: PlacementDefaultKey): string {
  return `Moved to ${folderName}, your default folder for ${defaultKeyEntry(key).noun}.`;
}

export async function moveOnTemplatePick(at: {
  ownerId: string;
  documentId: string;
  // The wizard's handoff, taken at the pick (useTemplatePickMove).
  handoff: TemplatePickHandoff;
  kind: TemplateKind;
  // Teams are Clerk-only: a guest's team folders are never read.
  signedIn: boolean;
}): Promise<string | null> {
  const { handoff } = at;
  if (handoff.placementChosen) return null;
  try {
    if (await isOfflineId(at.documentId)) return null;
    const [doc, defaults, folders, teams] = await Promise.all([
      apiLoadDocument(at.ownerId, at.documentId),
      apiListPlacementDefaults(at.ownerId),
      apiListFolders(at.ownerId),
      at.signedIn ? apiListTeams(at.ownerId) : Promise.resolve([]),
    ]);
    if (!doc) return null;
    const libraries = await Promise.all(
      teams.map((t) =>
        apiGetTeamLibrary(at.ownerId, t.id)
          .then((lib) => lib.folders.map((f) => ({ ...f, teamId: t.id })))
          .catch(() => []),
      ),
    );
    const index = buildDefaultFolderIndex(
      folders.filter((f) => f.teamId == null),
      libraries.flat(),
      teams,
    );
    const intent = creationIntentOf(
      buildTemplatedTab(at.kind, 'brand', 'intent', 'Tab 1'),
      templateFamilyOf(at.kind),
    );
    const target = templatePickMoveTarget({
      handoff,
      intent,
      current: { folderId: doc.folderId, teamId: doc.teamId },
      defaults: new Map(defaults.map((d) => [d.key, d.folderId])),
      index,
    });
    if (!target) return null;
    await apiSetDocumentFolder(at.ownerId, at.documentId, target.folder.id, target.folder.teamId);
    debugLog(`[default-folders] moved on template pick key=${target.key}`);
    return movedMessage(target.folder.name, target.key);
  } catch (err) {
    debugLog(`[default-folders] template pick move failed: ${String(err)}`);
    return null;
  }
}
