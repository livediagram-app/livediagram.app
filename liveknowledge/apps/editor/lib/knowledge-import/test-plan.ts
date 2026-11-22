// Test support: import plans built by hand, and a save layer that records what it is asked to store.
import type { Tab } from '@liveknowledge/document';
import type { ImportPlan, PlannedPage, PlannedPicture } from '@liveknowledge/knowledge-import';
import type { ImportImageOutcome } from '@/lib/import-images';
import type { BatchResult, ImportSaveLayer } from './write-plan';

export function plannedPage(key: string, over: Partial<PlannedPage> = {}): PlannedPage {
  return {
    key,
    title: `Page ${key}`,
    parentKey: null,
    markdown: `Writing of ${key}.`,
    links: [],
    pictures: [],
    attachments: [],
    warnings: [],
    ...over,
  };
}

export function planOf(
  pages: PlannedPage[],
  over: Partial<ImportPlan['summary']> = {},
): ImportPlan {
  return {
    pages,
    summary: {
      source: 'markdown-folder',
      pages: pages.length,
      pictures: new Set(pages.flatMap((p) => p.pictures.map((x) => x.path))).size,
      attachments: 0,
      skipped: [],
      ignoredFiles: 0,
      blocked: null,
      ...over,
    },
  };
}

export const picture = (path: string, bytes = 4): PlannedPicture => ({
  path,
  alt: `Alt of ${path}`,
  size: bytes,
  read: async () => new Uint8Array(bytes),
});

export const storedPicture = (imageId: string): ImportImageOutcome => ({
  ok: true,
  imageId,
  width: 400,
  height: 300,
  kind: 'uploaded',
});

/** A save layer that keeps each batch it is handed and answers what `answer` says (nothing failed by default). */
export function recordingLayer(
  answer: (pages: Tab[], batch: number) => BatchResult | Promise<BatchResult> = () => ({
    failed: new Map(),
  }),
): ImportSaveLayer & { batches: Tab[][] } {
  const batches: Tab[][] = [];
  return {
    batches,
    writeBatch: async (pages) => {
      batches.push(pages);
      return answer(pages, batches.length - 1);
    },
  };
}
