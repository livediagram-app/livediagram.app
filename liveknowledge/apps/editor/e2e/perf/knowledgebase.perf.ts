import type { CDPSession, Page } from '@playwright/test';
import { newKnowledgebasePageContent } from '@liveknowledge/document';
import {
  describeReading,
  probeThrottle,
  readMainThreadProbe,
  startMainThreadProbe,
  throttleCpu,
} from '@liveworkspace/e2e-kit/perf/main-thread-probe';
import { adoptGuest, expect, mintGuest, ownerHeaders, seedDocumentItem, test } from '../fixtures';
import { END_OF_WRITING, pageTree, paragraphs, titleOf, writing } from '../knowledgebase';

// The knowledgebase's typing and tree probes (docs/specs/030-knowledgebase/blueprints/continuous-page.md
// "Performance and limits", page-tree.md "Performance and limits"; build plan step 15 "measure"): typing at the
// foot of a 100,000 character page, and opening a knowledgebase of 500 pages. Each is measured as the machine runs
// it and again with the CPU slowed to the reference speed (@liveworkspace/e2e-kit calibrate.ts). They report and
// never fail on a number; a harness error (seeding, the stack) does fail them. Run by hand:
// `pnpm --filter @liveknowledge/editor perf:knowledgebase`.

const LONG_PAGE_PARAGRAPHS = 100;
const PARAGRAPH_CHARS = 1000;
const KEYS = Number(process.env.PERF_KEYS ?? 60);
const TREE_PAGES = 500;

const sentence = 'The queue worker restarts with the blue lever and reports to the duty engineer. ';
const paragraphText = (i: number) =>
  `${i} ${sentence.repeat(Math.ceil(PARAGRAPH_CHARS / sentence.length))}`.slice(0, PARAGRAPH_CHARS);

// One page as every knowledgebase page is made (newKnowledgebasePageContent), with this writing.
function pageOf(id: string, name: string, bodies: string[], parent?: string) {
  const content = newKnowledgebasePageContent();
  const flow = Object.keys(content.articles)[0]!;
  return {
    id,
    name,
    elements: [],
    ...(parent ? { parent } : {}),
    ...content,
    articles: {
      [flow]: {
        ...content.articles[flow],
        blocks: [
          { id: `${id}-t`, type: 'paragraph', style: 'title', runs: [{ text: name }] },
          ...bodies.map((text, i) => ({ id: `${id}-b${i}`, type: 'paragraph', runs: [{ text }] })),
        ],
      },
    },
  };
}

async function seed(page: Page, baseURL: string, name: string, tabs: unknown[]): Promise<string> {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const res = await seedDocumentItem(
    page.request,
    ownerHeaders(owner, { Origin: new URL(baseURL).origin }),
    { id, name, tabs },
  );
  expect(res.ok(), `seeding ${name}: ${res.status()} ${await res.text()}`).toBe(true);
  await adoptGuest(page, owner);
  await page.addInitScript(() => localStorage.setItem('liveknowledge:v2:name-confirmed', '1'));
  return id;
}

const layoutMetrics = async (cdp: CDPSession) => {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const of = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
  return {
    layouts: of('LayoutCount'),
    styles: of('RecalcStyleCount'),
    layoutMs: of('LayoutDuration') * 1000,
    styleMs: of('RecalcStyleDuration') * 1000,
    scriptMs: of('ScriptDuration') * 1000,
  };
};

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;

test('typing at the foot of a 100,000 character page', async ({ page, browser, baseURL }) => {
  test.setTimeout(10 * 60_000);
  const bodies = Array.from({ length: LONG_PAGE_PARAGRAPHS }, (_, i) => paragraphText(i));
  const id = await seed(page, baseURL!, 'Long page', [
    pageOf(crypto.randomUUID(), 'Long Page', bodies),
  ]);
  const reference = await probeThrottle(browser, process.env.PERF_THROTTLE);

  for (const rate of [1, reference]) {
    const opened = Date.now();
    await page.goto(`/document/${id}`);
    await titleOf(page).waitFor({ timeout: 60_000 });
    // Every paragraph drawn (the second run finds the lines the first one typed as well).
    await expect
      .poll(() => paragraphs(page).count(), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(LONG_PAGE_PARAGRAPHS);
    const shownMs = Date.now() - opened;
    const chars = (await writing(page).textContent())!.length;
    // The caret at the very end of the writing: the writing takes the focus, and the end key goes to its foot
    // (the view follows the caret; a 35,000 px page has no scroll position for a click to scroll to), and the
    // last paragraph is on screen before a key is timed.
    await writing(page).focus();
    await page.keyboard.press(END_OF_WRITING);
    await expect(paragraphs(page).last()).toBeInViewport();
    await page.keyboard.type(' ');
    await page.waitForTimeout(1500);

    const cdp = await throttleCpu(page, rate);
    await cdp.send('Performance.enable');
    // Each keystroke's time: from its keydown to the second frame after it, when what it changed has been painted.
    await page.evaluate(() => {
      const times: number[] = [];
      (window as unknown as { __keyTimes: number[] }).__keyTimes = times;
      window.addEventListener(
        'keydown',
        () => {
          const at = performance.now();
          requestAnimationFrame(() =>
            requestAnimationFrame(() => times.push(performance.now() - at)),
          );
        },
        true,
      );
    });
    const before = await layoutMetrics(cdp);
    await startMainThreadProbe(page);
    // Words, with a pause between keys as a person leaves one, and two new lines.
    const text = 'typing at the foot of a long page.\nA new line here.\nAnd one more';
    for (const key of text.slice(0, KEYS)) {
      await page.keyboard.press(key === '\n' ? 'Enter' : key === ' ' ? 'Space' : key);
      await page.waitForTimeout(60);
    }
    // The typing's idle commit and the autosave after it are part of what typing costs.
    await page.waitForTimeout(2500);
    const reading = await readMainThreadProbe(page);
    const after = await layoutMetrics(cdp);
    const times = (
      await page.evaluate(() => (window as unknown as { __keyTimes: number[] }).__keyTimes)
    ).sort((a, b) => a - b);
    const keys = Math.min(KEYS, text.length);
    console.log(
      [
        `\n[perf] typing, ${chars.toLocaleString('en')} characters, ${keys} keys @${rate}x (the page's writing shown ${shownMs} ms after navigation)`,
        `  key to second frame: median ${quantile(times, 0.5).toFixed(1)} ms, p95 ${quantile(times, 0.95).toFixed(1)} ms, max ${(times[times.length - 1] ?? 0).toFixed(1)} ms`,
        `  ${describeReading('main thread', rate, reading)}`,
        `  long tasks over 50 ms: ${reading.longTasks.length} in ${keys} keys`,
        `  layouts ${after.layouts - before.layouts} (${((after.layouts - before.layouts) / keys).toFixed(1)} a key, ${(after.layoutMs - before.layoutMs).toFixed(0)} ms), style recalcs ${after.styles - before.styles} (${(after.styleMs - before.styleMs).toFixed(0)} ms), script ${(after.scriptMs - before.scriptMs).toFixed(0)} ms`,
      ].join('\n'),
    );
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  }
});

test('opening the tree of a 500 page knowledgebase', async ({ page, browser, baseURL }) => {
  test.setTimeout(10 * 60_000);
  // Fifty top-level pages, nine subpages under each: 500 pages, every row on screen once the tree is open.
  const tabs: unknown[] = [];
  for (let top = 0; top < TREE_PAGES / 10; top += 1) {
    const parent = crypto.randomUUID();
    tabs.push(pageOf(parent, `Section ${top + 1}`, ['A section.']));
    for (let child = 0; child < 9; child += 1)
      tabs.push(pageOf(crypto.randomUUID(), `Page ${top + 1}.${child + 1}`, ['A page.'], parent));
  }
  const id = await seed(page, baseURL!, 'Five hundred pages', tabs);
  const reference = await probeThrottle(browser, process.env.PERF_THROTTLE);

  for (const rate of [1, reference]) {
    await page.goto('about:blank');
    const cdp = await throttleCpu(page, rate);
    const started = Date.now();
    await page.goto(`/document/${id}`);
    await pageTree(page).getByRole('treeitem').first().waitFor({ timeout: 120_000 });
    const treeMs = Date.now() - started;
    await titleOf(page).waitFor({ timeout: 120_000 });
    const writingMs = Date.now() - started;
    const rows = await pageTree(page).getByRole('treeitem').count();

    // A new browser shows every section open, so all 500 rows are drawn by the open itself.
    await expect(pageTree(page).getByRole('treeitem')).toHaveCount(TREE_PAGES, {
      timeout: 120_000,
    });
    const allRowsMs = Date.now() - started;
    console.log(
      [
        `\n[perf] tree of ${TREE_PAGES} pages @${rate}x`,
        `  navigation to the first row ${treeMs} ms, to the writing ${writingMs} ms, to all ${rows} rows ${allRowsMs} ms`,
      ].join('\n'),
    );
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  }
});
