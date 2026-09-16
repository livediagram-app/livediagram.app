import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const seed = JSON.parse(readFileSync('/tmp/eswall-review/seed.json', 'utf8'));
const OUT = '/home/webber/Repositories/livediagram-eswall/apps/live/out/review';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', deviceScaleFactor: 2 });
await ctx.addInitScript(([id, sig]) => {
  localStorage.setItem('livediagram:v2:self-id', id as string);
  if (sig) localStorage.setItem('livediagram:v2:self-sig', sig as string);
  localStorage.setItem('livediagram:v2:name-confirmed', '1');
}, [seed.ownerId, seed.ownerSig]);
const p = await ctx.newPage();
p.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0,200)));
p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,200)));
await p.goto(`http://localhost:3102/diagram/${seed.photo}/`);
await p.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30000 });
await p.getByRole('button', { name: /^no thanks$/i }).first().click({ timeout: 4000 }).catch(() => {});
for (const l of [/collapse explorer/i, /collapse map/i]) {
  await p.getByRole('button', { name: l }).first().click({ timeout: 1500 }).catch(() => {});
}
await p.getByRole('button', { name: /^Add from photo/ }).last().click();
await p.setInputFiles('input[type="file"]', '/tmp/eswall-wall-photos/20260826_024931.jpg');
await p.locator('[data-testid="photo-draft-bar"]').waitFor({ timeout: 60000 }).catch(async () => { await p.screenshot({ path: '/tmp/draft-timeout.png' }); console.log('NO BAR; shot saved'); });
console.log('bar:', await p.locator('[data-testid="photo-draft-bar"] p').textContent());
await p.keyboard.press('Shift+1');
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/draft.png` });
// Leave the board exactly as the reviewer will find it.
await p.getByRole('button', { name: /^discard$/i }).click();
await p.waitForTimeout(1500);
console.log('discarded; board left pristine');
await b.close();
