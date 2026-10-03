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
import {
  MAX_TAB_BYTES,
  creationIntentOf,
  tabDataBytes,
  type CreationIntent,
} from '@livediagram/api-schema';
import { track } from '@/lib/telemetry';
import { ApiError, apiCreateDocument } from '@/lib/api-client';
import { offlineCreateDocument } from '@/lib/offline/offline-store';
import {
  browserHugText,
  browserImageSession,
  type CreateImageSession,
  type HugText,
} from '@/lib/board-scene-browser';
import { debugLog } from '@/lib/debug-log';

// A board whose document the server refuses as too large (413): its own failure, never "try again".
export const BOARD_TOO_BIG = 'This board is too big for one document';

/** Image progress, and which board of how many it belongs to when several import at once. */
export type BoardImportProgress = ImportImageProgress & { board?: number; boards?: number };

/** A new document as the import creates it. */
export type NewBoardDocument = {
  id: string;
  name: string;
  tabs: Tab[];
  folderId?: string | null;
  // What the document opens as, from its first tab (docs/specs/013-workspace/default-folders.md):
  // imported at the root of My documents, it lands in the person's default folder for it.
  intent: CreationIntent;
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
  // The personal folder the documents are filed in; absent, the root.
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

/** What a source document is made of once prepared: its tabs, what landed and changed, its images. */
export type PreparedDocument = {
  tabs: Tab[];
  report: BoardSceneReport;
  images?: ImportImageReport;
};

/**
 * One document an import makes, before it is prepared: its name and dates (ISO, checked by the
 * board date rule), its kind for telemetry, and how to prepare it (images stored, tabs built). A
 * source that cannot be prepared answers its reason.
 */
export type ImportDocumentSource = {
  name: string;
  kind: 'whiteboard' | 'diagram';
  createdAt?: string;
  modifiedAt?: string;
  prepare: (
    onProgress: (p: ImportImageProgress) => void,
  ) => Promise<PreparedDocument | { error: string }>;
};

const pageTooLarge = (name: string) => `Page '${name}' is too large to store`;

/**
 * Make every source its own new document, filed in `folderId` (docs/specs/020-import-export/
 * board-import.md "new-document"). A tab too large for one database row is left out and named; a
 * document left with no tab, or that cannot be prepared or created, is listed with its reason; the
 * rest still land.
 */
export async function importDocuments(
  sources: readonly ImportDocumentSource[],
  o: BoardDocumentsImport,
): Promise<ImportOutcome> {
  const createDocument = o.createDocument ?? defaultCreateDocument(o.ownerId, o.offline);
  const documents: { id: string; name: string }[] = [];
  const failures: { title: string; message: string }[] = [];
  let report: BoardSceneReport | undefined;
  let images: ImportImageReport | undefined;
  for (const [i, source] of sources.entries()) {
    const dates = boardDocumentDates(source, Date.now());
    const { name } = source;
    const prepared = await source.prepare((p) =>
      o.onProgress?.({ ...p, board: i + 1, boards: sources.length }),
    );
    if ('error' in prepared) {
      failures.push({ title: name, message: prepared.error });
      continue;
    }
    // The worker's own cap (D1's row, docs/specs/015-api/api.md "Tab size"), checked here first so a
    // tab that cannot fit is named at once. This browser's store has no row cap: offline, it lands.
    const tabs: Tab[] = [];
    const omitted: string[] = [];
    for (const tab of prepared.tabs) {
      const bytes = tabDataBytes(tab);
      if (!o.offline && bytes > MAX_TAB_BYTES) {
        console.warn('[board-scene] board too big', { board: i + 1, bytes, cap: MAX_TAB_BYTES });
        omitted.push(tab.name);
      } else tabs.push(tab);
    }
    if (tabs.length === 0) {
      failures.push({ title: name, message: BOARD_TOO_BIG });
      continue;
    }
    const id = crypto.randomUUID();
    try {
      await createDocument({
        id,
        name,
        tabs,
        intent: creationIntentOf(tabs[0]),
        ...(o.folderId ? { folderId: o.folderId } : {}),
        ...(dates.createdAt !== undefined ? { createdAt: dates.createdAt } : {}),
        ...(dates.savedAt !== undefined ? { savedAt: dates.savedAt } : {}),
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 413) {
        // The server refused it as too large after all: no retry will help, so say what it is.
        const bytes = tabs.reduce((n, tab) => n + tabDataBytes(tab), 0);
        console.warn('[board-scene] board too big', { board: i + 1, bytes, cap: MAX_TAB_BYTES });
        failures.push({ title: name, message: BOARD_TOO_BIG });
        continue;
      }
      console.warn('[board-scene] import board failed', { board: i + 1, error: String(error) });
      failures.push({ title: name, message: "The document couldn't be created. Try again." });
      continue;
    }
    documents.push({ id, name });
    // A multi-tab document whose other pages landed: each page left out is named.
    if (prepared.tabs.length > 1) {
      for (const page of omitted) failures.push({ title: name, message: pageTooLarge(page) });
    }
    track('Document', 'Created', o.offline ? 'Offline' : 'Cloud');
    if (source.kind === 'whiteboard') track('Draw', 'Created', 'Import');
    const boardReport: BoardSceneReport = dates.unreadable
      ? addReports(prepared.report, {
          landed: {},
          degraded: [{ rule: UNREADABLE_DATES_RULE, count: 1 }],
          skipped: [],
        })
      : prepared.report;
    report = report ? addReports(report, boardReport) : boardReport;
    if (prepared.images) {
      images = addImageReports(images ?? emptyImportImageReport(), prepared.images);
    }
  }
  debugLog('[board-scene] import', {
    boards: sources.length,
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

/**
 * Make every scene its own new document with one tab that opens in Draw mode, named and dated as its board,
 * filed in `folderId`. A board that cannot land is listed with its reason; the rest still do.
 */
export async function importBoardsAsDocuments(
  scenes: readonly BoardScene[],
  o: BoardDocumentsImport,
): Promise<ImportOutcome> {
  return importDocuments(
    scenes.map((scene): ImportDocumentSource => {
      const dates = boardDocumentDates(scene, Date.now());
      return {
        name: boardDocumentName(scene, dates.createdAt),
        kind: 'whiteboard',
        ...(scene.createdAt !== undefined ? { createdAt: scene.createdAt } : {}),
        ...(scene.modifiedAt !== undefined ? { modifiedAt: scene.modifiedAt } : {}),
        prepare: async (onProgress) => {
          const landed = landBoardScene(scene, {
            profile: 'whiteboard',
            placement: { kind: 'origin' },
            mintId: () => crypto.randomUUID(),
          });
          if (!landed.ok) return { error: landed.message };
          const done = await finishLanding(landed, {
            ownerId: o.ownerId,
            documentId: null,
            offline: o.offline,
            whiteboard: true,
            tabFont: undefined,
            createImageSession: o.createImageSession,
            hugText: o.hugText,
            onProgress,
          });
          const { opensIn, backgroundPattern } = landed.tabPatch;
          const tab: Tab = {
            id: crypto.randomUUID(),
            name: UNTITLED_BOARD_NAME,
            opensIn,
            backgroundPattern,
            elements: done.elements,
            templateChosen: true,
          };
          return {
            tabs: [tab],
            report: landed.report,
            ...(done.images ? { images: done.images } : {}),
          };
        },
      };
    }),
    o,
  );
}
