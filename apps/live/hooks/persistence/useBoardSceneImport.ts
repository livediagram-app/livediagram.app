// The Import dialog's commit paths for board scenes (docs/specs/020-import-export/board-import.md
// "Stages", docs/specs/020-import-export/board-scene.md "In the editor"): replace the active tab
// with a scene in one undoable step (the Excalidraw card), or make each scene its own new document,
// named and dated as its board (the Microsoft Whiteboard card). Images are stored first either way.

import { isWhiteboardTab, type Element, type Tab } from '@livediagram/document';
import { landBoardScene, type LandedBoardScene } from '@/lib/board-scene/land';
import type { BoardScene } from '@/lib/board-scene/scene';
import type { BoardSceneReport } from '@/lib/board-scene/report';
import { mergeNotes } from '@/lib/board-scene/report';
import {
  attachImportImages,
  emptyImportImageReport,
  type ImportImageProgress,
  type ImportImageReport,
} from '@/lib/import-images';
import type { ImportOutcome } from '@/lib/import-tab';
import { track } from '@/lib/telemetry';
import { apiCreateDocument } from '@/lib/api-client';
import { isOfflineId, offlineCreateDocument } from '@/lib/offline/offline-store';
import {
  boardDocumentDates,
  boardDocumentName,
  UNREADABLE_DATES_RULE,
  UNTITLED_BOARD_NAME,
} from '@/lib/board-scene/board-document';
import {
  browserHugText,
  browserImageSession,
  type CreateImageSession,
  type HugText,
} from '@/hooks/canvas/board-scene-browser';

/** Image progress, and which board of how many it belongs to when several import at once. */
export type BoardImportProgress = ImportImageProgress & { board?: number; boards?: number };

/** A new document as the import creates it. */
export type NewBoardDocument = {
  id: string;
  name: string;
  tabs: Tab[];
  createdAt?: number;
  savedAt?: number;
};

export type BoardSceneImportDeps = {
  tabs: Tab[];
  activeId: string;
  ownerId: string;
  // The open document: an Offline Mode one makes Offline Mode documents, as a copy does.
  documentId: string | null;
  // The existing replace (useTabImport): merge onto the active tab, one undo step, then frame it.
  replaceActiveTabContent: (imported: Tab) => void;
  // New documents were made: the Explorer's list refreshes.
  onDocumentsCreated?: () => void;
  // Seams for tests; the defaults are the browser's (and the api's, or this browser's store).
  createImageSession?: CreateImageSession;
  hugText?: HugText;
  createDocument?: (doc: NewBoardDocument) => Promise<void>;
};

// Creates a document on the server, or in this browser for an Offline Mode one.
function defaultCreateDocument(ownerId: string, offline: boolean) {
  return async (doc: NewBoardDocument): Promise<void> => {
    if (offline) {
      await offlineCreateDocument({ id: doc.id, name: doc.name, tabs: doc.tabs }, Date.now(), {
        createdAt: doc.createdAt,
        savedAt: doc.savedAt,
      });
      return;
    }
    await apiCreateDocument(ownerId, doc);
  };
}

// Adds b's counts into a.
function addImageReports(a: ImportImageReport, b: ImportImageReport): ImportImageReport {
  const placeholders = { ...a.placeholders };
  for (const [k, n] of Object.entries(b.placeholders) as [keyof typeof placeholders, number][]) {
    placeholders[k] = (placeholders[k] ?? 0) + n;
  }
  return { imported: a.imported + b.imported, deduped: a.deduped + b.deduped, placeholders };
}

function addReports(a: BoardSceneReport, b: BoardSceneReport): BoardSceneReport {
  const landed = { ...a.landed };
  for (const [k, n] of Object.entries(b.landed) as [keyof typeof landed, number][]) {
    landed[k] = (landed[k] ?? 0) + n;
  }
  return {
    landed,
    ...mergeNotes([
      ...a.degraded,
      ...b.degraded,
      ...a.skipped.map((r) => ({ ...r, kind: 'skipped' as const })),
      ...b.skipped.map((r) => ({ ...r, kind: 'skipped' as const })),
    ]),
  };
}

export function useBoardSceneImport(deps: BoardSceneImportDeps) {
  const createSession = deps.createImageSession ?? browserImageSession;
  const hugText = deps.hugText ?? browserHugText;

  // Images and the text hug for one landed scene; the elements ready to commit.
  const finish = async (
    landed: LandedBoardScene,
    whiteboard: boolean,
    tabFont: string | undefined,
    onProgress?: (p: ImportImageProgress) => void,
  ): Promise<{ elements: Element[]; images?: ImportImageReport }> => {
    let elements = landed.elements;
    let images: ImportImageReport | undefined;
    if (landed.imageRequests.length > 0) {
      const session = await createSession({ ownerId: deps.ownerId, documentId: deps.documentId });
      ({ elements, report: images } = await attachImportImages(
        elements,
        landed.imageRequests,
        session,
        onProgress,
      ));
    }
    if (whiteboard) elements = await hugText(elements, tabFont);
    return { elements, images };
  };

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
    const whiteboard = isWhiteboardTab(active);
    const landed = landBoardScene(scene, {
      profile: whiteboard ? 'whiteboard' : 'diagram',
      placement: { kind: 'origin' },
      mintId: () => crypto.randomUUID(),
    });
    if (!landed.ok) return { status: 'error', error: landed.message };
    const { elements, images } = await finish(landed, whiteboard, active.font, onProgress);
    const { tabPatch } = landed;
    deps.replaceActiveTabContent({
      id: active.id,
      name: active.name,
      elements,
      theme: active.theme,
      ...(tabPatch.backgroundColor ? { backgroundColor: tabPatch.backgroundColor } : {}),
      // A whiteboard keeps its own background unless the scene names one.
      ...(whiteboard && scene.background?.pattern
        ? { backgroundPattern: tabPatch.backgroundPattern }
        : {}),
    });
    console.info('[board-scene] import', { boards: 1, target: 'replace-tab', failures: 0 });
    return { status: 'done', ...(images ? { images } : {}), scene: landed.report };
  };

  /**
   * Make every scene its own new document with one whiteboard tab, named and dated as its board
   * (docs/specs/020-import-export/board-import.md "new-document"). The open document is not touched;
   * a board that cannot land is listed with its reason and the rest still do.
   */
  const importScenesAsNewDocuments = async (
    scenes: BoardScene[],
    onProgress?: (p: BoardImportProgress) => void,
  ): Promise<ImportOutcome> => {
    const offline = deps.documentId !== null && (await isOfflineId(deps.documentId));
    const createDocument = deps.createDocument ?? defaultCreateDocument(deps.ownerId, offline);
    const documents: { id: string; name: string }[] = [];
    const failures: { title: string; message: string }[] = [];
    let report: BoardSceneReport | undefined;
    let images: ImportImageReport | undefined;
    for (const [i, scene] of scenes.entries()) {
      const dates = boardDocumentDates(scene, Date.now());
      const name = boardDocumentName(scene, dates.createdAt);
      const landed = landBoardScene(scene, {
        profile: 'whiteboard',
        placement: { kind: 'origin' },
        mintId: () => crypto.randomUUID(),
      });
      if (!landed.ok) {
        failures.push({ title: name, message: landed.message });
        continue;
      }
      const done = await finish(landed, true, undefined, (p) =>
        onProgress?.({ ...p, board: i + 1, boards: scenes.length }),
      );
      const { kind, backgroundPattern } = landed.tabPatch;
      const id = crypto.randomUUID();
      const tab: Tab = {
        id: crypto.randomUUID(),
        name: UNTITLED_BOARD_NAME,
        kind,
        backgroundPattern,
        elements: done.elements,
        templateChosen: true,
      };
      try {
        await createDocument({
          id,
          name,
          tabs: [tab],
          ...(dates.createdAt !== undefined ? { createdAt: dates.createdAt } : {}),
          ...(dates.savedAt !== undefined ? { savedAt: dates.savedAt } : {}),
        });
      } catch (error) {
        console.warn('[board-scene] import board failed', { board: i + 1, error: String(error) });
        failures.push({ title: name, message: "The document couldn't be created. Try again." });
        continue;
      }
      documents.push({ id, name });
      track('Document', 'Created', offline ? 'Offline' : 'Cloud');
      track('Whiteboard', 'Created', 'Import');
      const boardReport: BoardSceneReport = dates.unreadable
        ? addReports(landed.report, {
            landed: {},
            degraded: [{ rule: UNREADABLE_DATES_RULE, count: 1 }],
            skipped: [],
          })
        : landed.report;
      report = report ? addReports(report, boardReport) : boardReport;
      if (done.images) images = addImageReports(images ?? emptyImportImageReport(), done.images);
    }
    console.info('[board-scene] import', {
      boards: scenes.length,
      target: 'new-document',
      offline,
      documents: documents.length,
      failures: failures.length,
    });
    if (documents.length === 0) {
      return { status: 'error', error: failures[0]?.message ?? 'There was no board to import.' };
    }
    deps.onDocumentsCreated?.();
    return {
      status: 'done',
      documents,
      ...(images ? { images } : {}),
      ...(report ? { scene: report } : {}),
      ...(failures.length > 0 ? { failures } : {}),
    };
  };

  return { importSceneIntoActiveTab, importScenesAsNewDocuments };
}
