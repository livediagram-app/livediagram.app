import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { buildDocx } from './docx-build';
import { writeDocx } from './docx-write';
import { buildDeck } from './pptx-build';
import { writePptx } from './pptx-write';
import { fakeDrawer, longArticleTab, longDeckTab } from './test-tabs';

// docs/specs/020-import-export/office-export.md "Performance": the card's two worst cases, a 50-slide deck and a
// 30-page article, built and written inside a budget (the pictures faked: their cost is the canvas renderer's, the
// image export's own).

const DECK_SLIDES = 50;
const ARTICLE_PAGES = 30;
const DECK_BUDGET_MS = 200;
const ARTICLE_BUDGET_MS = 200;

describe('PowerPoint and Word export speed', () => {
  it(`builds and writes a ${DECK_SLIDES}-slide deck within its budget`, async () => {
    const { tab, pages } = longDeckTab(DECK_SLIDES);
    const run = async () =>
      writePptx(await buildDeck({ tab, pages, title: 'Perf' }, fakeDrawer(), {}));
    await run();
    let bytes: Uint8Array | undefined;
    const ms = await cpuMsOfAsync(async () => {
      bytes = await run();
    });
    expect(bytes!.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(cpuBudgetMs(DECK_BUDGET_MS));
  });

  it(`builds and writes a ${ARTICLE_PAGES}-page article within its budget`, async () => {
    const { tab, pages } = longArticleTab(ARTICLE_PAGES);
    const run = async () =>
      writeDocx(
        await buildDocx({ tab, pages, title: 'Perf', themeAccent: '#2563eb' }, fakeDrawer(), {}),
      );
    await run();
    let bytes: Uint8Array | undefined;
    const ms = await cpuMsOfAsync(async () => {
      bytes = await run();
    });
    expect(bytes!.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(cpuBudgetMs(ARTICLE_BUDGET_MS));
  });
});
