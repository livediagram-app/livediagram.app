// PowerPoint and Word export, tab to file (docs/specs/020-import-export/office-export.md; the blueprint's
// "exportOfficeFile"). The one entry the Export dialog imports, lazily, so the writers stay out of the editor's first
// bundle. Never throws: every failure comes back named.

import { themeAccent, type Deck, type LaidOutPage, type Tab } from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { ImageExportOpts } from '../export-tab';
import { getTheme } from '../themes';
import { buildDocx } from './docx-build';
import { DOCX_MIME, writeDocx } from './docx-write';
import { DrawRefused, pageDrawer } from './page-drawer';
import { buildDeck } from './pptx-build';
import { PPTX_MIME, writePptx } from './pptx-write';
import { ExportCancelled, type ExportProgress } from './progress';

export type OfficeExportFormat = 'pptx' | 'docx';
export type OfficeExportFailure = 'draw' | 'gone' | 'failed';

export type OfficeExportInput = {
  format: OfficeExportFormat;
  tab: Tab;
  pages: readonly LaidOutPage[];
  /** The Slide Deck, for each page's notes and hidden flag. */
  deck?: Deck;
  /** The document's name, the file's title. */
  title: string;
  images?: ImageExportOpts['images'];
  resolveTabWindow?: ImageExportOpts['resolveTabWindow'];
  tabWindowFontIds?: ImageExportOpts['tabWindowFontIds'];
};

export type OfficeExportResult =
  | { ok: true; blob: Blob }
  | { ok: false; failure: OfficeExportFailure }
  | { ok: false; cancelled: true };

export const OFFICE_EXPORT_MESSAGES: Readonly<Record<OfficeExportFailure, string>> = {
  draw: "This Browser couldn't draw a picture for the file. Try Chrome, Edge or Firefox, or a PDF.",
  gone: 'This tab has no pages to export any more.',
  failed: "Couldn't make the file. Try again, or export a PDF.",
};

export async function exportOfficeFile(
  input: OfficeExportInput,
  progress: ExportProgress = {},
): Promise<OfficeExportResult> {
  if (input.pages.length === 0) return { ok: false, failure: 'gone' };
  const started = performance.now();
  try {
    const drawer = await pageDrawer(input.tab, input);
    let blob: Blob;
    if (input.format === 'pptx') {
      const deck = await buildDeck(input, drawer, progress);
      blob = new Blob([writePptx(deck)], { type: PPTX_MIME });
    } else {
      const doc = await buildDocx(
        { ...input, themeAccent: themeAccent(getTheme(input.tab.theme, 'light')) },
        drawer,
        progress,
      );
      blob = new Blob([writeDocx(doc)], { type: DOCX_MIME });
    }
    debugLog('[office-export]', 'made', {
      format: input.format,
      pages: input.pages.length,
      bytes: blob.size,
      ms: Math.round(performance.now() - started),
    });
    return { ok: true, blob };
  } catch (error) {
    if (error instanceof ExportCancelled) {
      debugLog('[office-export]', 'cancelled', { format: input.format });
      return { ok: false, cancelled: true };
    }
    const failure: OfficeExportFailure = error instanceof DrawRefused ? 'draw' : 'failed';
    console.warn('[office-export] failed', failure, error);
    return { ok: false, failure };
  }
}
