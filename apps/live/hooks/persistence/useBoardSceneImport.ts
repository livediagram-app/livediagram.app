// The Import dialog's commit paths for board scenes (docs/specs/020-import-export/board-import.md
// "Stages", docs/specs/020-import-export/board-scene.md "In the editor"): replace the active tab
// with a scene in one undoable step (the Excalidraw card), or make each scene its own new document,
// named and dated as its board (lib/board-scene-import, shared with the Explorer page).

import type { Tab } from '@livediagram/document';
import { landBoardScene } from '@/lib/board-scene/land';
import type { BoardScene } from '@/lib/board-scene/scene';
import type { ImportImageProgress } from '@/lib/import-images';
import type { ImportOutcome } from '@/lib/import-tab';
import { isOfflineId } from '@/lib/offline/offline-store';
import {
  finishLanding,
  importBoardsAsDocuments,
  type BoardImportProgress,
  type LandingSeams,
  type NewBoardDocument,
} from '@/lib/board-scene-import';
import { debugLog } from '@/lib/debug-log';

export type { BoardImportProgress, NewBoardDocument } from '@/lib/board-scene-import';

export type BoardSceneImportDeps = {
  tabs: Tab[];
  activeId: string;
  // The viewer works on the active tab in Draw mode (docs/specs/007-editor/editor-modes.md): a
  // scene lands the whiteboard way.
  drawMode: boolean;
  ownerId: string;
  // The open document: an Offline Mode one makes Offline Mode documents, as a copy does.
  documentId: string | null;
  // The existing replace (useTabImport): merge onto the active tab, one undo step, then frame it.
  replaceActiveTabContent: (imported: Tab) => void;
  // New documents were made: the Explorer's list refreshes.
  onDocumentsCreated?: () => void;
  // Seams for tests; the defaults are the browser's (and the api's, or this browser's store).
  createDocument?: (doc: NewBoardDocument) => Promise<void>;
} & LandingSeams;

export function useBoardSceneImport(deps: BoardSceneImportDeps) {
  /** Replace the active tab with a scene, in its own profile. */
  const importSceneIntoActiveTab = async (
    scene: BoardScene,
    onProgress?: (p: ImportImageProgress) => void,
  ): Promise<ImportOutcome> => {
    const active = deps.tabs.find((t) => t.id === deps.activeId);
    if (!active) return { status: 'error', error: 'There is no tab to import into.' };
    if (active.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }
    const whiteboard = deps.drawMode;
    const landed = landBoardScene(scene, {
      profile: whiteboard ? 'whiteboard' : 'diagram',
      placement: { kind: 'origin' },
      mintId: () => crypto.randomUUID(),
    });
    if (!landed.ok) return { status: 'error', error: landed.message };
    const { elements, images } = await finishLanding(landed, {
      ownerId: deps.ownerId,
      documentId: deps.documentId,
      whiteboard,
      tabFont: active.font,
      onProgress,
      createImageSession: deps.createImageSession,
      hugText: deps.hugText,
    });
    const { tabPatch } = landed;
    deps.replaceActiveTabContent({
      id: active.id,
      name: active.name,
      elements,
      theme: active.theme,
      ...(tabPatch.backgroundColor ? { backgroundColor: tabPatch.backgroundColor } : {}),
      // In Draw mode the tab keeps its own background unless the scene names one.
      ...(whiteboard && scene.background?.pattern
        ? { backgroundPattern: tabPatch.backgroundPattern }
        : {}),
    });
    debugLog('[board-scene] import', { boards: 1, target: 'replace-tab', failures: 0 });
    return { status: 'done', ...(images ? { images } : {}), scene: landed.report };
  };

  /** Every scene its own new document; an Offline Mode open document makes Offline Mode ones. */
  const importScenesAsNewDocuments = async (
    scenes: BoardScene[],
    onProgress?: (p: BoardImportProgress) => void,
  ): Promise<ImportOutcome> =>
    importBoardsAsDocuments(scenes, {
      ownerId: deps.ownerId,
      offline: deps.documentId !== null && (await isOfflineId(deps.documentId)),
      onProgress,
      onDocumentsCreated: deps.onDocumentsCreated,
      createDocument: deps.createDocument,
      createImageSession: deps.createImageSession,
      hugText: deps.hugText,
    });

  return { importSceneIntoActiveTab, importScenesAsNewDocuments };
}
