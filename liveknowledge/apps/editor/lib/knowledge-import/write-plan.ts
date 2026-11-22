// Writing an import plan (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Writing the plan"): the
// pages made in tree order, twenty at a time, each batch's pictures stored first (three at a time) and its pages
// turned into tabs only then, so no more than one batch of parsed writing is ever held beside the plan. Every
// page's tab id is assigned before the first is written, so a link to a page further down the tree is written once,
// with the page that holds it. What stores a batch is handed in (save-layers.ts): the open knowledgebase's own save
// pipeline, or a new knowledgebase's create and saves.

import type { Tab } from '@liveknowledge/document';
import type { ImportPlan, PlannedPage, PlannedPicture } from '@liveknowledge/knowledge-import';
import { IMPORT_IMAGE_CONCURRENCY } from '@liveworkspace/workbench/lib/import-images/constants';
import type { ImportImageFailure, ImportImageOutcome } from '@/lib/import-images';
import { importedPageTab, type PictureResult } from './page-content';

/** Pages written in one state update and one round of saves. */
export const IMPORT_BATCH_PAGES = 20;
/** Pictures being read and stored at once: the import image pipeline's own bound. */
export const IMPORT_PICTURE_CONCURRENCY = IMPORT_IMAGE_CONCURRENCY;

/** What one batch's write came to. */
export type BatchResult = {
  /** Pages that were not stored, by tab id, each with why. */
  failed: ReadonlyMap<string, string>;
  /** Set when the save pipeline stopped answering: nothing more is written, and what was added keeps saving. */
  stalled?: true;
};

/** Where an import's pages are stored. A batch's pages come parents first, every parent in this batch, an earlier
 *  one, or already there. */
export type ImportSaveLayer = {
  writeBatch(pages: Tab[], flow: string): Promise<BatchResult>;
};

export type ImportProgress = { done: number; total: number };

export type ImportWriteDeps = {
  save: ImportSaveLayer;
  /** One picture through the Media upload path. Never throws: a failure is an outcome. */
  storePicture(picture: PlannedPicture): Promise<ImportImageOutcome>;
  /** A fresh tab id. */
  newId(): string;
  /** The page the import lands under; absent for the top level of a new knowledgebase. */
  parent?: string;
  /** The look every page takes, as a new page takes the open page's. */
  seed?: Partial<Tab>;
  offline?: boolean;
  /** Read between batches: true stops the import there. What was written stays. */
  cancelled(): boolean;
  onProgress(progress: ImportProgress): void;
};

export type FailedPage = { title: string; reason: string };
export type FailedPicture = { page: string; picture: string; reason: string };

export type ImportWriteResult = {
  total: number;
  /** Pages stored. */
  imported: number;
  /** The first page stored, to open. */
  first: { id: string; title: string } | null;
  failedPages: FailedPage[];
  failedPictures: FailedPicture[];
  cancelled: boolean;
  stalled: boolean;
};

const PICTURE_FAILURES: Record<ImportImageFailure, string> = {
  'missing-bytes': 'It could not be read from the archive.',
  unsupported: 'Its format is not one a picture can be.',
  'too-large': 'It is larger than 10 MB.',
  'gallery-full': 'Your Media library is full.',
  'images-unavailable': 'Pictures cannot be stored right now.',
  'offline-budget': 'This Offline knowledgebase has no room left for pictures.',
  'upload-failed': 'It could not be uploaded.',
};

const nameOf = (path: string) => path.split('/').pop() || path;

// Runs `work` over `items`, at most `limit` at once, in order of asking.
async function pooled<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export async function writeImportPlan(
  plan: ImportPlan,
  deps: ImportWriteDeps,
): Promise<ImportWriteResult> {
  const pages = plan.pages;
  const total = pages.length;
  // Every page's id before any page is written: a link is resolved once, where it is written.
  const idOf = new Map<string, string>();
  const parentKeyOf = new Map<string, string | null>();
  for (const page of pages) {
    idOf.set(page.key, deps.newId());
    parentKeyOf.set(page.key, page.parentKey);
  }
  // Pages that were not stored: links to them read as their words, and their subpages move up to the page above.
  const lost = new Set<string>();
  const pageIdOf = (key: string) => (lost.has(key) ? undefined : idOf.get(key));
  const parentOf = (page: PlannedPage): string | undefined => {
    let key = page.parentKey;
    while (key !== null && key !== undefined && lost.has(key)) key = parentKeyOf.get(key) ?? null;
    return key ? idOf.get(key) : deps.parent;
  };
  // A picture file many pages show is stored once.
  const stored = new Map<string, Promise<ImportImageOutcome>>();
  const storeOnce = (picture: PlannedPicture) => {
    let outcome = stored.get(picture.path);
    if (!outcome) {
      outcome = deps
        .storePicture(picture)
        .catch((): ImportImageOutcome => ({ ok: false, failure: 'upload-failed' }));
      stored.set(picture.path, outcome);
    }
    return outcome;
  };

  const result: ImportWriteResult = {
    total,
    imported: 0,
    first: null,
    failedPages: [],
    failedPictures: [],
    cancelled: false,
    stalled: false,
  };
  const losePage = (page: PlannedPage, reason: string) => {
    lost.add(page.key);
    result.failedPages.push({ title: page.title, reason });
  };
  deps.onProgress({ done: 0, total });

  for (let at = 0; at < total; at += IMPORT_BATCH_PAGES) {
    if (deps.cancelled()) {
      result.cancelled = true;
      break;
    }
    const batch = pages.slice(at, at + IMPORT_BATCH_PAGES);
    // The batch's pictures, three at a time: at most three pictures' bytes are held at once.
    const outcomes = new Map<PlannedPage, PictureResult[]>(
      batch.map((page) => [page, new Array<PictureResult>(page.pictures.length)]),
    );
    const jobs = batch.flatMap((page) =>
      page.pictures.map((picture, index) => ({ page, picture, index })),
    );
    await pooled(jobs, IMPORT_PICTURE_CONCURRENCY, async ({ page, picture, index }) => {
      const outcome = await storeOnce(picture);
      outcomes.get(page)![index] = outcome;
      if (!outcome.ok) {
        result.failedPictures.push({
          page: page.title,
          picture: nameOf(picture.path),
          reason: PICTURE_FAILURES[outcome.failure],
        });
      }
    });

    // The batch's tabs, made now and let go once they are stored.
    const tabs: Tab[] = [];
    const byId = new Map<string, PlannedPage>();
    let flow = '';
    for (const page of batch) {
      const id = idOf.get(page.key)!;
      const made = importedPageTab({
        page,
        id,
        parent: parentOf(page),
        pageIdOf,
        pictures: outcomes.get(page)!,
        seed: deps.seed,
        offline: deps.offline,
      });
      if (!made.ok) {
        losePage(page, made.reason);
        continue;
      }
      flow = made.flow;
      tabs.push(made.tab);
      byId.set(id, page);
    }
    if (tabs.length > 0) {
      const written = await deps.save.writeBatch(tabs, flow).catch((): BatchResult => ({
        failed: new Map(tabs.map((t) => [t.id, 'It could not be saved.'])),
        stalled: true,
      }));
      for (const tab of tabs) {
        const page = byId.get(tab.id)!;
        const reason = written.failed.get(tab.id);
        if (reason !== undefined) {
          losePage(page, reason);
          continue;
        }
        result.imported += 1;
        result.first ??= { id: tab.id, title: tab.name };
      }
      if (written.stalled) {
        result.stalled = true;
        deps.onProgress({ done: Math.min(total, at + batch.length), total });
        break;
      }
    }
    deps.onProgress({ done: Math.min(total, at + batch.length), total });
  }
  return result;
}
