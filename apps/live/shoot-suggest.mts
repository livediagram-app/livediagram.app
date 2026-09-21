// The offer, mid-drag: an actor held over the empty lane below two commands,
// with the brick slot it will land in outlined before the drop.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const seed = JSON.parse(readFileSync('/tmp/eswall-review/seed.json', 'utf8'));
const OUT = '/tmp/eswall-review/assets';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([id]) => {
  localStorage.setItem('livediagram:v2:self-id', id as string);
  localStorage.setItem('livediagram:v2:name-confirmed', '1');
}, [seed.ownerId]);
const p = await ctx.newPage();
await p.goto(`http://localhost:3102/diagram/${seed.lanes}/`);
await p.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30000 });
await p.getByRole('button', { name: /^no thanks$/i }).first().click({ timeout: 4000 }).catch(() => {});
for (const l of [/collapse explorer/i, /collapse map/i]) {
  await p.getByRole('button', { name: l }).first().click({ timeout: 1500 }).catch(() => {});
}
await p.keyboard.press('Shift+1');
await p.waitForTimeout(600);
// Out one step, so the empty lane below the commands is fully on screen.
await p.getByRole('button', { name: /zoom out/i }).first().click().catch(() => {});
await p.waitForTimeout(600);

// The NOTE, not the text inside it: its box is what gives the zoom.
const label = (t: string) =>
  p.getByRole('img', { name: new RegExp(`^Sticky note.*${t}`, 'i') }).first();
const box = (await label('ORDER PLACED').boundingBox())!;
const zoom = box.height / 200;
// The lone event sits at (0,0). Aim 40px past the first rhythm slot in its
// own lane (272 = its right edge + the gutter): inside the capture radius,
// nowhere near any old snap threshold.
const dx = (272 + 40 - 0) * zoom;
const dy = 8 * zoom;
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 20 });
await p.waitForTimeout(400);
console.log('ghost on screen:', await p.locator('[data-testid="timeline-lane-ghost"]').count());
await p.screenshot({ path: `${OUT}/lanes-suggest.png` });
// Abandon the drag: the board stays exactly as the reviewer will find it.
await p.keyboard.press('Escape');
await p.mouse.up();
await p.waitForTimeout(600);
await b.close();
