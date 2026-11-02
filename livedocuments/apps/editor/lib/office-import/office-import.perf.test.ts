import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { articlesOf, pagesOf } from '@livedocuments/document';
import type { ImportImageSession } from '../import-images';
import { importOfficeFile } from './index';
import { asBlob, longDeck, longDocx } from './test-fixtures';

// docs/specs/020-import-export/office-import.md "Performance": the card's two worst cases, a 100-page document and a
// 50-slide deck, read and built inside a budget (the image pipeline faked: its own cost is the pipeline's).

const DOCUMENT_PAGES = 100;
const DECK_SLIDES = 50;
const DOCUMENT_BUDGET_MS = 300;
const DECK_BUDGET_MS = 300;

const session: ImportImageSession = {
  store: async () => ({ ok: true, imageId: 'img', width: 400, height: 300, kind: 'deduped' }),
};
const deps = { tabName: 'Perf', offline: false, createSession: async () => session };

describe('Word and PowerPoint import speed', () => {
  it(`reads a ${DOCUMENT_PAGES}-page document within its budget`, async () => {
    const file = asBlob(await longDocx(DOCUMENT_PAGES));
    // Warm the module up once, as the browser has by the second import.
    await importOfficeFile(file, 'word', deps);
    let result: Awaited<ReturnType<typeof importOfficeFile>> | undefined;
    const ms = await cpuMsOfAsync(async () => {
      result = await importOfficeFile(file, 'word', deps);
    });
    if (!result?.ok) throw new Error('import failed');
    const blocks = Object.values(articlesOf(result.tab))[0]!.blocks.length;
    // A heading, five paragraphs and two list items a page, and a picture every ten.
    expect(blocks).toBe(DOCUMENT_PAGES * 8 + DOCUMENT_PAGES / 10);
    expect(ms).toBeLessThan(cpuBudgetMs(DOCUMENT_BUDGET_MS));
  });

  it(`reads a ${DECK_SLIDES}-slide deck within its budget`, async () => {
    const file = asBlob(await longDeck(DECK_SLIDES));
    await importOfficeFile(file, 'powerpoint', deps);
    let result: Awaited<ReturnType<typeof importOfficeFile>> | undefined;
    const ms = await cpuMsOfAsync(async () => {
      result = await importOfficeFile(file, 'powerpoint', deps);
    });
    if (!result?.ok) throw new Error('import failed');
    expect(pagesOf(result.tab)).toHaveLength(DECK_SLIDES);
    expect(result.tab.elements).toHaveLength(DECK_SLIDES * 3);
    expect(ms).toBeLessThan(cpuBudgetMs(DECK_BUDGET_MS));
  });
});
