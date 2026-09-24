import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { DetectedSticky } from '../../../sticky-vision/src/detect';
import { photoDir } from '../../../sticky-vision/scripts/truth';
import { score, type ScoredBox } from '../../../sticky-vision/scripts/truth';
import { mergedFloorOf, realMergedOf, table, type Row } from '../report';

// The hybrid as the EDITOR runs it (group M): headless Chromium drives a built
// editor through /new → Event storming → Add from photo for each labelled
// wall, reads every box the review shows (its style's left / top / width /
// height, as fractions of the photo), and scores them with the classical
// sweep's own scorer. The same walls then go through the hybrid in Node, on
// the weights the editor ships, and every box is compared: the table must
// equal `sweep.ts --kept`'s, and each box must sit where Node put it.
//
//   E2E_BASE_URL=http://localhost:3202 npx tsx scripts/hybrid/editor-sweep.ts
//     [--no-model]  (block the weights: the editor must fall back, and equal
//                    the classical sweep instead)
//     [--gpu]       (ask Chromium for the real GPU, so WebGPU can run)
//
// The photographs are uploaded from their private folder into a local page;
// nothing is written anywhere but the console.

const repoRoot = resolve(import.meta.dirname, '../../../..');
const shipped = `${repoRoot}/apps/live/lib/photo-model/weights`;
// The Node side scores the weights the editor ships, not the float originals.
process.env.STICKY_MODEL_WEIGHTS ??= shipped;
const { loadHybridWalls } = await import('./walls');
const { HYBRID_RULES } = await import('../../../sticky-vision/src/hybrid');
const { detectStickies } = await import('../../../sticky-vision/src/detect');
const { CUE_OPTIONS, cuesOf } = await import('../../src/cues');

const base = process.env.E2E_BASE_URL ?? 'http://localhost:3202';
const noModel = process.argv.includes('--no-model');
const gpu = process.argv.includes('--gpu');

type Page = {
  addInitScript(script: string): Promise<void>;
  goto(url: string): Promise<unknown>;
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  on(event: 'console', fn: (m: { text(): string }) => void): void;
  getByText(t: string | RegExp, o?: { exact?: boolean }): Locator;
  getByRole(role: string, o: { name: RegExp }): Locator;
  locator(s: string): Locator;
  setInputFiles(selector: string, path: string): Promise<void>;
  evaluate<R>(fn: () => R): Promise<R>;
  close(): Promise<void>;
};
type Locator = {
  first(): Locator;
  click(): Promise<void>;
  waitFor(o?: { state?: string; timeout?: number }): Promise<void>;
};
type Route = {
  request(): { postData(): string | null };
  fulfill(o: {
    status?: number;
    contentType?: string;
    body?: string;
    json?: unknown;
  }): Promise<void>;
  abort(): Promise<void>;
};
type Browser = { newPage(o: Record<string, unknown>): Promise<Page>; close(): Promise<void> };
const { chromium } = createRequire(`${repoRoot}/packages/sticky-vision/package.json`)(
  '@playwright/test',
) as { chromium: { launch(o: { args: string[] }): Promise<Browser> } };

type Shown = { x: number; y: number; w: number; h: number; kind: string; id: number };

async function openBoard(page: Page) {
  // A model is "configured", so the server reader runs; it is stubbed blank,
  // the same as the e2e suite, so no words are sent anywhere.
  await page.route('**/api/capabilities', (r) =>
    r.fulfill({ json: { aiEnabled: true, emailEnabled: false } }),
  );
  await page.route('**/api/ai/read-notes', async (r) => {
    const crops = (JSON.parse(r.request().postData() ?? '{}').crops ?? []) as { id: number }[];
    await r.fulfill({
      json: { texts: crops.map((c) => ({ id: c.id, text: '', legible: false })) },
    });
  });
  if (noModel) await page.route('**/weights.*.bin', (r) => r.abort());
  await page.goto(`${base}/new`);
  await page.getByText('New Diagram', { exact: false }).waitFor();
  await page
    .getByRole('button', { name: /Browse Technical templates/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: /^Event storming/i })
    .first()
    .click();
  await page.getByRole('button', { name: /^next$/i }).click();
  await page
    .getByRole('button', { name: /^(create|start|use this|done|finish)$/i })
    .first()
    .click();
  await page.locator('[data-canvas-a11y-root]').waitFor();
  const decline = page.getByRole('button', { name: /^no thanks$/i }).first();
  await decline
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => decline.click())
    .catch(() => {});
}

async function editorBoxes(
  browser: Browser,
  file: string,
): Promise<{ boxes: Shown[]; detector: string; ms: number; log: string[] }> {
  const page = await browser.newPage({
    colorScheme: 'dark',
    viewport: { width: 1400, height: 900 },
  });
  // tsx names every function it compiles with a `__name` helper; the
  // function handed to the page is serialised without it.
  await page.addInitScript('window.__name = (f) => f');
  const log: string[] = [];
  page.on('console', (m) => {
    if (m.text().startsWith('[photo-')) log.push(m.text());
  });
  await openBoard(page);
  await page.getByRole('button', { name: /add from photo/i }).click();
  const started = Date.now();
  await page.setInputFiles('input[type="file"]', file);
  await page.locator('[data-testid="photo-review-overlay"][data-detector]').waitFor({
    timeout: 60_000,
  });
  const ms = Date.now() - started;
  const read = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>('[data-testid="photo-review-overlay"]')!;
    const pct = (v: string) => Number.parseFloat(v) / 100;
    return {
      detector: overlay.dataset.detector ?? '',
      boxes: [...overlay.querySelectorAll<HTMLElement>('[data-testid^="note-box-"]')].map((el) => ({
        id: Number(el.dataset.testid!.slice('note-box-'.length)),
        kind: el.dataset.kind ?? '',
        x: pct(el.style.left),
        y: pct(el.style.top),
        w: pct(el.style.width),
        h: pct(el.style.height),
      })),
    };
  });
  await page.close();
  return { ...read, ms, log };
}

const walls = await loadHybridWalls();
const browser = await chromium.launch({
  args: gpu
    ? [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--use-angle=vulkan',
        '--enable-features=Vulkan',
      ]
    : [],
});
const dir = photoDir();
const rows: Row[] = [];
let worst = 0;
let mismatched = 0;
for (const wall of walls) {
  const { width, height } = wall.image;
  const shown = await editorBoxes(browser, `${dir}/${wall.name}`);
  const boxes: ScoredBox[] = shown.boxes.map((b) => ({
    x: b.x * width,
    y: b.y * height,
    w: b.w * width,
    h: b.h * height,
    kind: b.kind,
  }));
  const s = score(wall.truth, boxes, width, height);
  const labels = wall.truth.notes.map((n) => ({
    x: n.x * width,
    y: n.y * height,
    w: n.w * width,
    h: n.h * height,
  }));
  const name = wall.name.replace(/\.[^.]+$/, '');
  rows.push({
    name,
    score: s,
    ms: shown.ms,
    realMerged: realMergedOf(s, labels),
    floor: mergedFloorOf(labels),
  });

  // Box by box against Node, on the same pixels and weights.
  const model = noModel
    ? undefined
    : { cues: cuesOf(wall.probs, width, height, CUE_OPTIONS), rules: HYBRID_RULES };
  const node: DetectedSticky[] = detectStickies(wall.image, model ? { model } : {});
  const byId = new Map(node.map((b) => [b.id, b]));
  let off = 0;
  for (const b of boxes.map((b, i) => ({ ...b, id: shown.boxes[i]!.id }))) {
    const n = byId.get(b.id);
    const d = n
      ? Math.max(Math.abs(n.x - b.x), Math.abs(n.y - b.y), Math.abs(n.w - b.w), Math.abs(n.h - b.h))
      : Infinity;
    if (d > 0.01 || n?.kind !== b.kind) off += 1;
    if (Number.isFinite(d)) worst = Math.max(worst, d);
  }
  off += Math.abs(node.length - boxes.length);
  mismatched += off;
  console.log(
    `${name.padEnd(20)} ${shown.detector.padEnd(9)} ${String(shown.ms).padStart(6)} ms  ` +
      `editor ${boxes.length} boxes, node ${node.length}, ${off} differ  | ${shown.log.join(' | ')}`,
  );
}
await browser.close();
console.log(table(rows));
console.log(
  `box by box against Node (${noModel ? 'classical' : 'hybrid'}): ${mismatched} differ, ` +
    `largest offset ${worst.toFixed(4)} px`,
);
process.exitCode = mismatched === 0 ? 0 : 1;
