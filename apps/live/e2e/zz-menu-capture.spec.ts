import { writeFileSync } from 'node:fs';
import { apiBase } from './audit-screens';
import { expect, guestSigFor, mintSignedGuest, ownerHeaders, test, startBlankDocument, dismissQuickTour } from './fixtures';

const OUT = process.env.MENU_SHOTS ?? '/tmp/menu-aria-shots';
const TAG = process.env.MENU_TAG ?? 'before';

test('capture menus', async ({ page, baseURL }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 800 });
  const owner = await mintSignedGuest(page.request);
  await page.addInitScript(({ id, sig }) => {
    localStorage.setItem('livediagram:v2:ui-mode', 'dark');
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem('livediagram:v2:self-id', id);
    if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
  }, { id: owner, sig: guestSigFor(owner) });
  const headers = ownerHeaders(owner, { Origin: new URL(baseURL!).origin, 'Content-Type': 'application/json' });
  await page.request.post(`${apiBase}/folders`, { headers, data: { id: crypto.randomUUID(), name: 'Retros', parentId: null } });
  await page.goto('/explorer/all');
  const nav = page.getByRole('navigation', { name: 'Explorer' }).first();
  const row = nav.getByRole('treeitem', { name: 'Retros' });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.locator('[data-tree-row]').first().click({ button: 'right' });
  const menu = page.getByRole('menu').first();
  await expect(menu).toBeVisible();
  const snaps: string[] = [];
  snaps.push('## Folder menu\n' + (await menu.ariaSnapshot()));
  snaps.push('focused: ' + (await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))));
  await page.screenshot({ path: `${OUT}/${TAG}-folder-menu.png` });
  await page.getByText('Use as default for').click();
  await page.waitForTimeout(300);
  const sub = page.locator('[data-menu-flyout]');
  snaps.push('## Use as default for\n' + (await sub.ariaSnapshot()));
  await page.screenshot({ path: `${OUT}/${TAG}-folder-submenu.png` });
  await page.keyboard.press('Escape');
  await page.mouse.click(900, 700);

  await startBlankDocument(page);
  await dismissQuickTour(page);
  const canvas = page.locator('[data-canvas-a11y-root]');
  await page.getByRole('button', { name: 'Add square', exact: true }).click();
  await canvas.click({ position: { x: 520, y: 360 } });
  const square = page.getByRole('img', { name: 'Square', exact: true });
  await expect(square).toHaveCount(1);
  await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${TAG}-pre-ctx.png` }); const bb = (await square.boundingBox())!; await page.mouse.click(bb.x + bb.width - 12, bb.y + bb.height / 2, { button: 'right' });
  const ctx = page.locator('[data-context-menu]');
  await expect(ctx).toBeVisible();
  snaps.push('## Element menu\n' + (await ctx.ariaSnapshot()));
  await page.screenshot({ path: `${OUT}/${TAG}-element-menu.png` });
  writeFileSync(`${OUT}/${TAG}-aria.txt`, snaps.join('\n\n'));
});
