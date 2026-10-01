// Board scenes from other tools landed with everything the browser adds: images through the import
// image pipeline, text boxes hugged in our fonts (docs/specs/020-import-export/board-scene.md "In
// the editor"), and the new-document target (docs/specs/020-import-export/board-import.md
// "new-document"): each board its own document, named and dated as the board. Needs no editor
// state, so the editor's Import dialog and the Explorer page share it.

import type { Element, Tab } from '@livediagram/document';
import { landBoardScene, type LandedBoardScene } from '@/lib/board-scene/land';
import type { BoardScene } from '@/lib/board-scene/scene';
import { mergeNotes, type BoardSceneReport } from '@/lib/board-scene/report';
import {
  boardDocumentDates,
  boardDocumentName,
  UNREADABLE_DATES_RULE,
  UNTITLED_BOARD_NAME,
} from '@/lib/board-scene/board-document';
import {
  attachImportImages,
  emptyImportImageReport,
  type ImportImageProgress,
  type ImportImageReport,
} from '@/lib/import-images';
import type { ImportOutcome } from '@/lib/import-tab';
import { track } from '@/lib/telemetry';
import { apiCreateDocument } from '@/lib/api-client';
import { offlineCreateDocument } from '@/lib/offline/offline-store';
import {
  browserHugText,
  browserImageSession,
  type CreateImageSession,
  type HugText,
} from '@/lib/board-scene-browser';

/** Image progress, and which board of how many it belongs to when several import at once. */
export type BoardImportProgress = ImportImageProgress & { board?: number; boards?: number };

/** A new document as the import creates it. */
export type NewBoardDocument = {
  id: string;
  name: string;
  tabs: Tab[];
  folderId?: string | null;
  createdAt?: number;
  savedAt?: number;
};

// Adds b's counts into a.
export function addImageReports(a: ImportImageReport, b: ImportImageReport): ImportImageReport {
  const placeholders = { ...a.placeholders };
  for (const [k, n] of Object.entries(b.placeholders) as [keyof typeof placeholders, number][]) {
    placeholders[k] = (placeholders[k] ?? 0) + n;
  }
  return { imported: a.imported + b.imported, deduped: a.deduped + b.deduped, placeholders };
}

export function addReports(a: BoardSceneReport, b: BoardSceneReport): BoardSceneReport {
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

export type LandingSeams = {
  createImageSession?: CreateImageSession;
  hugText?: HugText;
};

/** A landed scene's images stored and (on a whiteboard) its text hugged: the elements to commit. */
export async function finishLanding(
  landed: LandedBoardScene,
  o: {
    ownerId: string;
    documentId: string | null;
    offline?: boolean;
    whiteboard: boolean;
    tabFont: string | undefined;
    onProgress?: (p: ImportImageProgress) => void;
  } & LandingSeams,
): Promise<{ elements: Element[]; images?: ImportImageReport }> {
  let elements = landed.elements;
  let images: ImportImageReport | undefined;
  if (landed.imageRequests.length > 0) {
    const session = await (o.createImageSession ?? browserImageSession)({
      ownerId: o.ownerId,
      documentId: o.documentId,
      ...(o.offline !== undefined ? { offline: o.offline } : {}),
    });
    ({ elements, report: images } = await attachImportImages(
      elements,
      landed.imageRequests,
      session,
      o.onProgress,
    ));
  }
  if (o.whiteboard) elements = await (o.hugText ?? browserHugText)(elements, o.tabFont);
  return { elements, images };
}

export type BoardDocumentsImport = {
  ownerId: string;
  // Offline Mode documents (in this browser), or cloud ones.
  offline: boolean;
  // The personal folder the documents are filed in; absent, Unsorted.
  folderId?: string | null;
  onProgress?: (p: BoardImportProgress) => void;
  // New documents were made: the caller's document list refreshes.
  onDocumentsCreated?: () => void;
  createDocument?: (doc: NewBoardDocument) => Promise<void>;
} & LandingSeams;

// Creates a document on the server, or in this browser for an Offline Mode one.
function defaultCreateDocument(ownerId: string, offline: boolean) {
  return async (doc: NewBoardDocument): Promise<void> => {
    if (offline) {
      await offlineCreateDocument({ id: doc.id, name: doc.name, tabs: doc.tabs }, Date.now(), {
        createdAt: doc.createdAt,
        savedAt: doc.savedAt,
        folderId: doc.folderId ?? null,
      });
      return;
    }
    await apiCreateDocument(ownerId, doc);
  };
}

/**
 * Make every scene its own new document with one whiteboard tab, named and dated as its board,
 * filed in `folderId`. A board that cannot land is listed with its reason; the rest still do.
 */
export async function importBoardsAsDocuments(
  scenes: readonly BoardScene[],
  o: BoardDocumentsImport,
): Promise<ImportOutcome> {
  const createDocument = o.createDocument ?? defaultCreateDocument(o.ownerId, o.offline);
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
    const done = await finishLanding(landed, {
      ownerId: o.ownerId,
      documentId: null,
      offline: o.offline,
      whiteboard: true,
      tabFont: undefined,
      createImageSession: o.createImageSession,
      hugText: o.hugText,
      onProgress: (p) => o.onProgress?.({ ...p, board: i + 1, boards: scenes.length }),
    });
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
        ...(o.folderId ? { folderId: o.folderId } : {}),
        ...(dates.createdAt !== undefined ? { createdAt: dates.createdAt } : {}),
        ...(dates.savedAt !== undefined ? { savedAt: dates.savedAt } : {}),
      });
    } catch (error) {
      console.warn('[board-scene] import board failed', { board: i + 1, error: String(error) });
      failures.push({ title: name, message: "The document couldn't be created. Try again." });
      continue;
    }
    documents.push({ id, name });
    track('Document', 'Created', o.offline ? 'Offline' : 'Cloud');
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
    offline: o.offline,
    documents: documents.length,
    failures: failures.length,
  });
  if (documents.length === 0) {
    return { status: 'error', error: failures[0]?.message ?? 'There was no board to import.' };
  }
  o.onDocumentsCreated?.();
  return {
    status: 'done',
    documents,
    ...(images ? { images } : {}),
    ...(report ? { scene: report } : {}),
    ...(failures.length > 0 ? { failures } : {}),
  };
}
