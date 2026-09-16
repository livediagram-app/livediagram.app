// Screenshots of the seeded review boards, straight from the running app, so
// the review page shows the real thing rather than my description of it.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync('/tmp/eswall-review/seed.json', 'utf8'));
const OUT = '/home/webber/Repositories/livediagram-eswall/apps/live/out/review';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
});
await ctx.addInitScript(
  ([id, sig]) => {
    localStorage.setItem('livediagram:v2:self-id', id as string);
    if (sig) localStorage.setItem('livediagram:v2:self-sig', sig as string);
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
  },
  [seed.ownerId, seed.ownerSig],
);

const shoot = async (id: string, name: string) => {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3102/diagram/${id}/`);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  const skip = page.getByRole('button', { name: /^no thanks$/i }).first();
  try {
    await skip.waitFor({ state: 'visible', timeout: 4000 });
    await skip.click();
  } catch {
    /* not offered */
  }
  // Dark scheme, panels out of the way, content fitted: the board is the
  // subject of the picture, not the furniture around it.
  for (const label of [/collapse explorer/i, /collapse map/i, /collapse minimap/i]) {
    await page.getByRole('button', { name: label }).first().click({ timeout: 1500 }).catch(() => {});
  }
  await page.getByRole('button', { name: /dark|appearance|theme/i }).first().click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.mouse.click(720, 780);
  await page.keyboard.press('Shift+1');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`shot ${name}`);
  await page.close();
};

await shoot(seed.lanes, 'lanes');
await shoot(seed.docking, 'docking');
await shoot(seed.photo, 'photo');
await browser.close();
