// draw.io imports beside draw.io's own render, page by page
// (docs/instructions/compare-drawio-imports.md).
//
// A script, not a test: the files it reads are usually personal diagrams, and its output (pictures
// of them) stays wherever --out points, never in the repo. For every draw.io file under the given
// paths it writes `<out>/<slug>/drawio-p<n>.png` (draw.io desktop's CLI export, when --drawio names
// the binary) and `<out>/<slug>/ld-p<n>.png` (the file imported through the editor's Import dialog
// against a running live app, each page's tab clipped to its elements at twice the pixel density).
//
//   pnpm --filter @livediagram/live exec tsx scripts/drawio-compare.mts <file or folder> [...] \
//     --out /tmp/drawio-compare --base http://localhost:3015 [--drawio /path/to/drawio] [--only <slug>]
//
// Exits non-zero when any file fails to import or render.

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chromium, type Page } from '@playwright/test';

type Args = { paths: string[]; out: string; base: string; drawio?: string; only?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { paths: [], out: '', base: 'http://localhost:3002' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    if (flag === '--out') args.out = argv[++i]!;
    else if (flag === '--base') args.base = argv[++i]!;
    else if (flag === '--drawio') args.drawio = argv[++i]!;
    else if (flag === '--only') args.only = argv[++i]!;
    else args.paths.push(flag);
  }
  if (!args.out || args.paths.length === 0) {
    console.error(
      'usage: drawio-compare.mts <file or folder> [...] --out <dir> [--base <url>] [--drawio <bin>]',
    );
    process.exit(2);
  }
  return args;
}

const filesUnder = (path: string): string[] =>
  statSync(path).isDirectory()
    ? readdirSync(path)
        .sort()
        .flatMap((child) => filesUnder(join(path, child)))
    : [path];

const slugOf = (root: string, file: string) =>
  (relative(root, file) || file)
    .replace(/\.(drawio|xml|png|svg)$/i, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

// Page names in file order: a diagram file's `<diagram name>`s, or one unnamed page.
function pageNames(file: string): string[] | null {
  const head = readFileSync(file).subarray(0, 16).toString('latin1');
  if (head.startsWith('\x89PNG')) return [''];
  const text = readFileSync(file, 'utf8');
  if (text.trimStart().startsWith('<mxlibrary')) return null;
  if (!/<mxfile|<mxGraphModel/.test(text)) return null;
  const names = [...text.matchAll(/<diagram\b[^>]*?\bname="([^"]*)"/g)].map((m) => m[1]!);
  return names.length > 0 ? names : [''];
}

// draw.io's own render of every page (pages are 1-based from draw.io 27).
function renderWithDrawio(bin: string, file: string, dir: string, pages: number) {
  const ext = readFileSync(file).subarray(0, 4).toString('latin1') === '\x89PNG' ? 'png' : 'drawio';
  const source = join(dir, `source.${ext}`);
  copyFileSync(file, source);
  for (let n = 1; n <= pages; n++) {
    execFileSync(
      'xvfb-run',
      [
        '-a',
        bin,
        '--no-sandbox',
        '--disable-gpu',
        '-x',
        '-f',
        'png',
        '-s',
        '1',
        '-b',
        '10',
        '-p',
        String(n),
        '-o',
        join(dir, `drawio-p${n}.png`),
        source,
      ],
      { stdio: 'ignore', timeout: 120_000 },
    );
  }
}

async function importThroughDialog(page: Page, base: string, file: string) {
  await page.goto(`${base}/new?blank=1`);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 90_000 });
  const decline = page.getByRole('button', { name: /^no thanks$/i }).first();
  if (await decline.isVisible({ timeout: 3_000 }).catch(() => false)) await decline.click();
  await page.getByRole('button', { name: 'Tab menu' }).click();
  const content = page.getByRole('button', { name: 'Content' });
  if ((await content.getAttribute('aria-expanded')) === 'false') await content.click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: /^draw\.io/ }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a file instead' }).click();
  await (await chooser).setFiles(file);
  // A clean import closes the dialog; one with a report waits on Done.
  const done = page.getByRole('button', { name: 'Done' });
  if (await done.isVisible({ timeout: 30_000 }).catch(() => false)) await done.click();
}

// The active tab's elements, framed and clipped.
async function shootTab(page: Page, path: string) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(1_500);
  const clip = await page.evaluate(() => {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const el of document.querySelectorAll('[data-element-id]')) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      [x0, y0, x1, y1] = [
        Math.min(x0, r.left),
        Math.min(y0, r.top),
        Math.max(x1, r.right),
        Math.max(y1, r.bottom),
      ];
    }
    if (!Number.isFinite(x0)) return undefined;
    const left = Math.max(0, x0 - 10);
    const top = Math.max(48, y0 - 10);
    return {
      x: left,
      y: top,
      width: Math.min(innerWidth, x1 + 10) - left,
      height: Math.min(innerHeight - 60, y1 + 10) - top,
    };
  });
  await page.screenshot({ path, clip });
}

const args = parseArgs(process.argv.slice(2));
const browser = await chromium.launch();
let failed = false;
for (const root of args.paths) {
  for (const file of filesUnder(root)) {
    const names = pageNames(file);
    if (!names) continue;
    const slug = slugOf(root, file);
    if (args.only && slug !== args.only) continue;
    const dir = join(args.out, slug);
    mkdirSync(dir, { recursive: true });
    try {
      if (args.drawio) renderWithDrawio(args.drawio, file, dir, names.length);
      const page = await browser.newPage({
        viewport: { width: 2400, height: 1600 },
        colorScheme: 'dark',
        deviceScaleFactor: 2,
      });
      page.on('pageerror', (error) =>
        console.error(`[drawio-compare] page-error slug=${slug} ${error.message}`),
      );
      await importThroughDialog(page, args.base, file);
      for (const [index, name] of names.entries()) {
        if (index > 0) await page.getByText(name, { exact: true }).last().click();
        await shootTab(page, join(dir, `ld-p${index + 1}.png`));
      }
      await page.close();
      console.log(`[drawio-compare] ok slug=${slug} pages=${names.length}`);
    } catch (error) {
      failed = true;
      console.error(
        `[drawio-compare] failed slug=${slug} ${(error as Error).message.split('\n')[0]}`,
      );
    }
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
