// Renders the brand mark (the apps' shared icon.svg) to transparent PNGs in
// marketing/media/icons/, at the sizes Google Drive's UI integration asks for.
// Run via `pnpm icons:brand` from the repo root.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 64, 128, 256, 512];
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const svg = readFileSync(`${root}apps/marketing/app/icon.svg`, 'utf8');
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const browser = await chromium.launch();
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html style="margin:0;background:transparent"><body style="margin:0">` +
      `<img src="${src}" width="${size}" height="${size}" style="display:block"></body></html>`,
  );
  await page.locator('img').evaluate((img) => img.decode());
  const path = `${root}marketing/media/icons/livediagram-icon-transparent-${size}.png`;
  await page.screenshot({ path, omitBackground: true });
  await page.close();
  console.log(`brand-icons: ${size}x${size} -> ${path.slice(root.length)}`);
}
await browser.close();
