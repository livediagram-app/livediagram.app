// Word and PowerPoint import, file to tab (docs/specs/020-import-export/office-import.md; the blueprint's
// "importOfficeFile"). The one entry the editor imports, lazily (useTabImport), so the readers stay out of the first
// bundle. Never throws: every failure comes back named.

import { MAX_TAB_BYTES } from '@livedocuments/api-schema';
import type { Tab } from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { ImportImageSession } from '../import-images';
import { buildArticleTab } from './build-article';
import { buildDeckTab, type ImportedSlideDetail } from './build-deck';
import { readDocx } from './docx';
import { OfficeImportError, type FileImportFormat, type OfficeImportFailure } from './errors';
import { OFFICE_MAX_FILE_BYTES } from './limits';
import { openOfficePackage, type OfficePackage } from './package';
import { readPptx } from './pptx';
import { officeImportReport, type ReportLine } from './report';
import { storePictures, type PictureOutcome } from './store-images';
import type { OfficePicture } from './docx';
import type { SkipTally } from './tally';

export { officeErrorMessage, type FileImportFormat } from './errors';
export type { ImportedSlideDetail } from './build-deck';

export type OfficeImportStage =
  { stage: 'reading' } | { stage: 'images'; done: number; total: number };

export type OfficeImportDeps = {
  tabName: string;
  /** An Offline Mode document: images are embedded and the tab never reaches the api, so its size is not capped. */
  offline: boolean;
  /** The import image session, made only when the file has pictures. */
  createSession: () => Promise<ImportImageSession>;
  onStage?: (stage: OfficeImportStage) => void;
};

export type OfficeImportResult =
  | { ok: true; tab: Tab; slides?: ImportedSlideDetail[]; failures: ReportLine[] }
  | { ok: false; failure: OfficeImportFailure; count?: number };

/** A tab's saved size, as the api counts it near enough: its content as UTF-8 JSON. */
export function tabBytes(tab: Pick<Tab, 'elements' | 'pages' | 'articles'>): number {
  const json = JSON.stringify({ elements: tab.elements, pages: tab.pages, articles: tab.articles });
  return new TextEncoder().encode(json).byteLength;
}

async function readAndBuild(
  pkg: OfficePackage,
  deps: OfficeImportDeps,
): Promise<{
  tab: Tab;
  slides?: ImportedSlideDetail[];
  tally: SkipTally;
  outcomes: Map<string, PictureOutcome>;
}> {
  const store = async (pictures: OfficePicture[]) => {
    if (pictures.length === 0) return new Map<string, PictureOutcome>();
    const session = await deps.createSession();
    return storePictures(pkg, pictures, session, (done, total) =>
      deps.onStage?.({ stage: 'images', done, total }),
    );
  };
  if (pkg.format === 'word') {
    const read = await readDocx(pkg);
    debugLog('[office-import]', 'read', {
      blocks: read.blocks.length,
      pictures: read.pictures.length,
      tally: read.tally,
    });
    const outcomes = await store(read.pictures);
    return {
      tab: buildArticleTab(read.blocks, outcomes, deps.tabName),
      tally: read.tally,
      outcomes,
    };
  }
  const read = await readPptx(pkg);
  debugLog('[office-import]', 'read', {
    slides: read.slides.length,
    pictures: read.pictures.length,
    tally: read.tally,
  });
  const outcomes = await store(read.pictures);
  const { tab, slides } = buildDeckTab(read, outcomes, deps.tabName);
  return { tab, slides, tally: read.tally, outcomes };
}

export async function importOfficeFile(
  file: Blob,
  format: FileImportFormat,
  deps: OfficeImportDeps,
): Promise<OfficeImportResult> {
  const refuse = (failure: OfficeImportFailure, count?: number): OfficeImportResult => {
    debugLog('[office-import]', 'refused', { failure, count });
    return { ok: false, failure, ...(count !== undefined ? { count } : {}) };
  };
  if (file.size > OFFICE_MAX_FILE_BYTES) return refuse('too-large');
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    deps.onStage?.({ stage: 'reading' });
    const pkg = await openOfficePackage(bytes, format);
    debugLog('[office-import]', 'opened', { format: pkg.format, entries: pkg.entryCount });
    const { tab, slides, tally, outcomes } = await readAndBuild(pkg, deps);
    const size = tabBytes(tab);
    debugLog('[office-import]', 'built', { bytes: size, elements: tab.elements.length });
    if (!deps.offline && size > MAX_TAB_BYTES) return refuse('too-large-for-tab');
    return {
      ok: true,
      tab,
      ...(slides && slides.length > 0 ? { slides } : {}),
      failures: officeImportReport(tally, outcomes, format),
    };
  } catch (error) {
    if (error instanceof OfficeImportError) return refuse(error.failure, error.count);
    console.warn('[office-import] error', error);
    return refuse('not-a-package');
  }
}
