// A Knowledgebase import run in the browser (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Writing
// the plan"): the write path (write-plan.ts) wired to the editor's page list and autosave, or to a new
// knowledgebase's create and saves, and to the import image pipeline for the pictures. Loaded with the dialog, so
// none of it is in the editor's first bundle.

import { CREATION_INTENT } from '@liveknowledge/api-schema';
import type { Tab } from '@liveknowledge/document';
import {
  ImportSizeError,
  type ImportPlan,
  type ImportSource,
  type PlannedPicture,
} from '@liveknowledge/knowledge-import';
import { whenTabSaved } from '@liveworkspace/workbench/lib/tab-saved';
import { apiCreateDocument, apiSaveDocumentMeta, apiSaveTab } from '@/lib/api-client';
import { markArticleSettle } from '@/lib/article/article-grow-store';
import type { ImportImageOutcome, ImportImageSession } from '@/lib/import-images';
import { newTabSeed } from '@/lib/new-tab-seed';
import { pictureMimeType } from '@/lib/office-import/store-images';
import { track } from '@/lib/telemetry';
import { newKnowledgebaseLayer, openKnowledgebaseLayer, unownedPagesLayer } from './save-layers';
import {
  writeImportPlan,
  type ImportProgress,
  type ImportSaveLayer,
  type ImportWriteResult,
} from './write-plan';

/** Where an import lands: a knowledgebase of its own, or under a page of the open one. */
export type ImportDestination = { kind: 'new' } | { kind: 'under'; pageId: string };

/** What the import needs of the open editor. */
export type KnowledgeImportHost = {
  ownerId: string;
  documentId: string;
  /** The open knowledgebase is kept Offline: a new one is too, and pictures are embedded. */
  offline: boolean;
  /** The team library the open knowledgebase is in, where a new one is filed too. */
  teamId: string | null;
  getTabs: () => Tab[];
  getActiveTab: () => Tab | undefined;
  commitTabs: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  markTabLoaded: (id: string) => void;
};

export type RunImportArgs = {
  plan: ImportPlan;
  source: ImportSource;
  /** The archive's name: what a new knowledgebase is called. */
  name: string;
  destination: ImportDestination;
  host: KnowledgeImportHost;
  cancelled: () => boolean;
  onProgress: (progress: ImportProgress) => void;
};

/** What an import came to, and the knowledgebase its pages are in. */
export type RunImportResult = ImportWriteResult & { documentId: string };

/** The telemetry type of each source (docs/specs/017-telemetry/telemetry.md): a closed token, never content. */
export const IMPORT_TELEMETRY: Record<ImportSource, string> = {
  'markdown-folder': 'MarkdownFolder',
  notion: 'Notion',
  confluence: 'Confluence',
};

// One picture read from the archive and stored. The read refuses a picture past 10 MB (the engine's bound); the
// pipeline holds it to its own limits after that.
async function storePicture(
  session: () => Promise<ImportImageSession>,
  picture: PlannedPicture,
): Promise<ImportImageOutcome> {
  let bytes: Uint8Array;
  try {
    bytes = await picture.read();
  } catch (error) {
    return { ok: false, failure: error instanceof ImportSizeError ? 'too-large' : 'missing-bytes' };
  }
  if (bytes.byteLength === 0) return { ok: false, failure: 'missing-bytes' };
  const blob = new Blob([bytes as BlobPart], { type: pictureMimeType(picture.path) });
  const name = picture.path.split('/').pop();
  return (await session()).store({ kind: 'blob', blob, ...(name ? { name } : {}) });
}

function newKnowledgebase(
  host: KnowledgeImportHost,
  documentId: string,
  name: string,
): ImportSaveLayer {
  return newKnowledgebaseLayer({
    create: async (pages) => {
      if (host.offline) {
        const { offlineCreateDocument } = await import('@/lib/offline/offline-store');
        await offlineCreateDocument({ id: documentId, name, tabs: pages }, Date.now());
      } else {
        await apiCreateDocument(host.ownerId, {
          id: documentId,
          name,
          tabs: pages,
          ...(host.teamId ? { teamId: host.teamId } : {}),
          intent: CREATION_INTENT,
        });
      }
      track('Document', 'Created', host.offline ? 'Offline' : 'Cloud');
    },
    saveTab: async (page) => {
      await apiSaveTab(host.ownerId, documentId, page, null, { allowEmpty: true });
    },
    saveOrder: (pages) => apiSaveDocumentMeta(host.ownerId, { id: documentId, tabs: pages }),
  });
}

export async function runImport(args: RunImportArgs): Promise<RunImportResult> {
  const { plan, destination, host } = args;
  const fresh = destination.kind === 'new';
  const documentId = fresh ? crypto.randomUUID() : host.documentId;
  // Made on the first picture, and once: an import with no pictures loads no image code.
  let session: Promise<ImportImageSession> | null = null;
  const sessionOf = () =>
    (session ??= import('@/lib/import-images/browser').then((m) =>
      m.createBrowserImportImageSession({
        ownerId: host.ownerId,
        documentId,
        offline: host.offline,
      }),
    ));
  // An import's pages take no owner (unownedPagesLayer).
  const save = unownedPagesLayer(
    fresh
      ? newKnowledgebase(host, documentId, args.name)
      : openKnowledgebaseLayer({
          documentId,
          getTabs: host.getTabs,
          commitTabs: host.commitTabs,
          markTabLoaded: host.markTabLoaded,
          markArticleSettle,
          whenSaved: whenTabSaved,
        }),
  );
  const result = await writeImportPlan(plan, {
    save,
    storePicture: (picture) => storePicture(sessionOf, picture),
    newId: () => crypto.randomUUID(),
    ...(destination.kind === 'under' ? { parent: destination.pageId } : {}),
    seed: newTabSeed(host.getActiveTab()),
    offline: host.offline,
    cancelled: args.cancelled,
    onProgress: args.onProgress,
  });
  if (result.imported > 0) track('Tab', 'Imported', IMPORT_TELEMETRY[args.source]);
  return { ...result, documentId };
}
