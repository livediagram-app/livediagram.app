import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { defaultCatalogue, ITEMS_MAX, presetSetup, type Item } from '@liveplanner/items';
import { tabToJsonText, type Tab } from '@liveplanner/project';
import {
  describeReading,
  probeThrottle,
  readMainThreadProbe,
  startMainThreadProbe,
  startCpuProfile,
  startProbeTrace,
  stopCpuProfile,
  throttleCpu,
  type MainThreadReading,
} from '@liveworkspace/e2e-kit/perf/main-thread-probe';
import { expect, startBlankProject, test } from '../fixtures';

// A full plan's board, imported and opened (docs/specs/026-plan/plan-board.md "A busy board", "A big board's first
// draw"): a Kanban board tab of ITEMS_MAX (2,000) cards, each with a long description, as a liveplanner Tab export of
// about 5.6 MB, imported onto a blank plan through the Import dialog; then the plan reloaded. Reports the longest task
// and frame gap of each at the reference speed (@liveworkspace/e2e-kit/perf/main-thread-probe): from the Import press
// until the board has drawn and held for two seconds, and from the reload until the same. Never fails on a number.
// Run against a production build: `E2E_PERF=1 pnpm exec playwright test --project=perf big-board`.
// BIG_BOARD_THROTTLE (a fixed rate), BIG_BOARD_TRACE=1 (a Chromium trace of each in test-results/perf),
// BIG_BOARD_PROFILE=1 (a CPU profile of each there, its heaviest functions printed).

const OUT = 'test-results/perf';
const CANVAS = '[data-canvas-a11y-root]';
const CARD = '[data-plan-board] [data-plan-card]';
const STATUSES = ['backlog', 'todo', 'doing', 'review', 'done'];
const by = { id: 'perf', name: 'Perf', color: '#2563eb' };

// The export, as the board's own Export writes it (tabToJsonText).
function bigBoardExport(): string {
  const description =
    'Check the quantities against the purchase order, confirm the delivery window. '.repeat(30);
  const items = new Map<string, Item>();
  for (let i = 0; i < ITEMS_MAX; i++) {
    const id = `item-${i}`;
    items.set(id, {
      id,
      type: 'task',
      key: i + 1,
      rank: `a${i.toString(36).padStart(4, '0')}`,
      fields: {
        title: `Card ${i}: follow up with the supplier about the March order`,
        status: STATUSES[i % STATUSES.length]!,
        description,
      },
      rev: 1,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      createdBy: by,
      updatedBy: by,
    });
  }
  const tab: Tab = {
    id: 'big-board',
    name: 'Orders',
    kind: 'board',
    elements: [
      {
        id: 'board',
        type: 'shape',
        shape: 'plan-board',
        x: 100,
        y: 100,
        width: 1400,
        height: 800,
        planBoard: presetSetup('kanban'),
      },
    ],
  };
  const catalogue = defaultCatalogue();
  return tabToJsonText(tab, { items, types: catalogue.types, catalogue });
}

// The board drawn: its first cards in view, then two quiet seconds for whatever follows the draw.
async function drawn(page: Page) {
  await expect(page.locator(CARD).first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2000);
}

const results: Record<string, MainThreadReading & { cardsBuilt: number; runs: string }> = {};
const report = async (page: Page, what: string, rate: number, reading: MainThreadReading) => {
  // How much of the board is built once it has settled: its cards, and its runs near of all.
  const cardsBuilt = await page.locator(CARD).count();
  const runs = `${await page.locator('[data-plan-run-near]').count()} of ${await page.locator('[data-plan-run]').count()}`;
  results[what] = { ...reading, cardsBuilt, runs };
  console.log(
    `${describeReading(what, rate, reading)}; ${cardsBuilt} cards built, runs near ${runs}`,
  );
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/big-board.json`, JSON.stringify(results, null, 2));
};

test('a 2,000-card board imported, then opened', async ({ page, browser }) => {
  test.setTimeout(300_000);
  const rate = await probeThrottle(browser, process.env.BIG_BOARD_THROTTLE);
  const tracing = process.env.BIG_BOARD_TRACE === '1';
  const profiling = process.env.BIG_BOARD_PROFILE === '1';
  const json = bigBoardExport();
  expect(json.length).toBeGreaterThan(5 * 1024 * 1024);

  await page.setViewportSize({ width: 1440, height: 900 });
  await startBlankProject(page);
  await page
    .getByRole('navigation', { name: 'Categories' })
    .getByRole('button', { name: 'Import', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Import' });
  await dialog.getByRole('button', { name: /^liveplanner Tab:/ }).click();
  await page.waitForTimeout(500);

  // The file dropped on the dialog, held (it is over 1 MiB), before the probe starts: Playwright's own hand-over of
  // a 5.6 MB file is a task of the harness, not the app's.
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.items.add(new File([text], 'orders.json', { type: 'application/json' }));
    const zone = document.querySelector('[data-testid="import-drop"]')!;
    for (const type of ['dragenter', 'dragover', 'drop'])
      zone.dispatchEvent(
        new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }),
      );
  }, json);
  const importButton = dialog.getByRole('button', { name: 'Import', exact: true });
  await expect(importButton).toBeEnabled();
  await page.waitForTimeout(1000);

  // Import: from the Import press until the board has drawn.
  const cdp = await throttleCpu(page, rate);
  await startMainThreadProbe(page);
  if (tracing) await startProbeTrace(browser, page, `${OUT}/big-board-import.trace.json`);
  if (profiling) await startCpuProfile(cdp);
  await importButton.click();
  await drawn(page);
  const imported = await readMainThreadProbe(page);
  if (tracing) await browser.stopTracing();
  if (profiling)
    console.log((await stopCpuProfile(cdp, `${OUT}/big-board-import.cpuprofile`)).join('\n'));
  await report(page, 'import 2000', rate, imported);
  await expect(page.locator(CARD).first()).toContainText('Card');

  // Open: the plan reloaded, from navigation until the board has drawn. The probe starts with the page.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.waitForTimeout(3000);
  await page.addInitScript(() => {
    const w = window as unknown as {
      __probe: { longestTaskMs: number; longTasks: number[]; longestGapMs: number; stop?: boolean };
    };
    w.__probe = { longestTaskMs: 0, longTasks: [], longestGapMs: 0 };
    let last = -1;
    const frame = (t: number) => {
      if (last >= 0) w.__probe.longestGapMs = Math.max(w.__probe.longestGapMs, t - last);
      last = t;
      if (!w.__probe.stop) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        w.__probe.longTasks.push(Math.round(e.duration));
        w.__probe.longestTaskMs = Math.max(w.__probe.longestTaskMs, e.duration);
      }
    }).observe({ type: 'longtask', buffered: true });
  });
  const reloadCdp = await throttleCpu(page, rate);
  if (tracing) await startProbeTrace(browser, page, `${OUT}/big-board-open.trace.json`);
  await page.reload();
  await page.locator(CANVAS).waitFor();
  await drawn(page);
  const opened = await readMainThreadProbe(page);
  if (tracing) await browser.stopTracing();
  // The frame gap is read from the first frame, after the page's own boot (its script's first evaluation, which
  // every page pays): the long tasks above include the boot.
  await report(page, 'open 2000', rate, opened);
  await reloadCdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});
