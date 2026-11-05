// Synthesised Excalidraw boards for the end-to-end imports (docs/specs/020-import-export/excalidraw-import-export.md
// "Import as new documents"): the Explorer's Import from, run on this site's /import page, makes each file its own
// canvas named after the file. Real boards are never fixtures.
import type { Page } from '@playwright/test';
import { excalidrawBuilder, excalidrawText } from '../lib/excalidraw-fixtures';
import { expect } from './fixtures';

/** The boards' names, as each canvas is named after its file. */
export const BOARD_NAMES = ['Sprint board', 'Retro board'] as const;

function boardFile(name: string) {
  const b = excalidrawBuilder();
  const box = b.rectangle({ x: 0, y: 0, width: 160, height: 70 });
  return {
    name: `${name}.excalidraw`,
    mimeType: 'application/json',
    buffer: Buffer.from(excalidrawText([box, b.label(box, name)], { type: 'excalidraw' })),
  };
}

/** Imports `boards` Excalidraw files at once through /import, and waits for the report. */
export async function importExcalidrawBoards(page: Page, boards: 1 | 2): Promise<void> {
  await page.goto('/import?source=excalidraw');
  await page
    .getByTestId('excalidraw-file-input')
    .setInputFiles(BOARD_NAMES.slice(0, boards).map(boardFile));
  await expect(page.getByTestId('import-documents')).toContainText(BOARD_NAMES[0]);
}
