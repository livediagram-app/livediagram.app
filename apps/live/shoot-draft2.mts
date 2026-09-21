// The draft moment, photographed. Detection is REAL (the browser runs the
// detector on the real wall photo); only the handwriting reading is canned,
// because the key's daily quota is spent. Discards at the end, so the board is
// left exactly as the reviewer will find it.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync('/tmp/eswall-review/seed.json', 'utf8'));
const OUT = '/tmp/eswall-review/assets';
const WORDS = [
  'CLASS SCHEDULED',
  'ROOM BOOKED',
  'MACHINE FIXED',
  'SCHEDULE CLASS',
  'ROOM CREATED',
  'ACTIVITY PLANNED',
  'COURSE CREATED',
  'CANCEL ACTIVITY',
  'CREATE COURSE',
  'IS THIS RELIABLE?',
  'UPDATE ACTIVITY',
  'COURSE PLANNED',
];

const b = await chromium.launch();
const ctx = await b.newContext({
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
const p = await ctx.newPage();
await p.route('**/api/ai/read-notes', async (route) => {
  const body = JSON.parse(route.request().postData() ?? '{}');
  const texts = (body.crops ?? []).map((c: { id: number }, i: number) => ({
    id: c.id,
    text: WORDS[(c.id + i) % WORDS.length],
    legible: true,
  }));
  await route.fulfill({ json: { texts } });
});
await p.goto(`http://localhost:3102/diagram/${seed.photo}/`);
await p.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
await p
  .getByRole('button', { name: /^no thanks$/i })
  .first()
  .click({ timeout: 4000 })
  .catch(() => {});
for (const l of [/collapse explorer/i, /collapse map/i]) {
  await p
    .getByRole('button', { name: l })
    .first()
    .click({ timeout: 1500 })
    .catch(() => {});
}
await p.getByRole('button', { name: /^Add from photo/ }).last().click();
await p.setInputFiles('input[type="file"]', '/tmp/eswall-wall-photos/20260826_024931.jpg');
await p.locator('[data-testid="photo-draft-bar"]').waitFor({ timeout: 90_000 });
console.log('bar:', await p.locator('[data-testid="photo-draft-bar"] p').textContent());
await p.keyboard.press('Shift+1');
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/draft.png` });
await p.getByRole('button', { name: /^Discard$/ }).click();
await p.waitForTimeout(2000);
console.log('discarded; board left as the reviewer will find it');
await b.close();
