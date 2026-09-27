// Screenshots every page `sheet.run.tsx` wrote (dark, 2x) next to its HTML. Run via `pnpm icons:sheet`.
import { readdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const dir = process.env.ICON_SHEET_DIR ?? '/tmp/icon-sheet';
const pages = readdirSync(dir).filter((f) => f.endsWith('.html'));
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
});
for (const f of pages) {
  await page.goto(`file://${dir}/${f}`);
  await page.screenshot({ path: `${dir}/${f.replace(/\.html$/, '.png')}`, fullPage: true });
}
await browser.close();
console.log(`icon-sheet: ${pages.length} pages in ${dir}`);
