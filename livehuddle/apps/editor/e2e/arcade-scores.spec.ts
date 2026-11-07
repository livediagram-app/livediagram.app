import type { Browser, Page } from '@playwright/test';
import {
  adoptGuest,
  documentHeaders,
  expect,
  mintGuest,
  seedTab,
  serverNewUrl,
  test,
} from './fixtures';
import { legacyViewerLink } from './legacy-viewer';

// An Arcade Machine's High Scores between browsers (docs/specs/009-elements/social-pieces.md "High Scores"): a
// Participant plays Moon Mail until it scores and closes the panel, which posts the score; the owner's Insert Coin
// bubble shows it as the machine's best, and a Viewer's panel lists it with no game. The owner then clears the table
// from the element menu, and it empties on the Participant's bubble and the Viewer's open panel alike. The score
// travels as one `arcade-score` delta through the room, so this is the one check of the table's wire end to end.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';
const SPACE = 'team-pod';
const MACHINE = 'arcade';

async function personIn(browser: Browser, baseURL: string, owner: string | null): Promise<Page> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  if (owner) await adoptGuest(ctx, owner);
  await ctx.addInitScript(
    ({ o }) => {
      if (o) localStorage.setItem('livehuddle:v2:name-confirmed', '1');
      localStorage.setItem(
        'livehuddle:user-preferences:v1',
        JSON.stringify({ workshopTourSeen: true }),
      );
    },
    { o: owner },
  );
  return ctx.newPage();
}

const self = (page: Page) => page.locator('[data-avatar="self"]');
const machine = (page: Page) => page.locator(`[data-element-id="${MACHINE}"]`).first();
const press = (page: Page) => page.getByRole('button', { name: 'Play Moon Mail' });
const best = (page: Page) => page.locator('[data-arcade-best]');
const panel = (page: Page) => page.getByRole('dialog', { name: 'Moon Mail' });

// A shared link may ask a newcomer's name first.
async function joinIfAsked(page: Page): Promise<void> {
  const join = page.getByRole('button', { name: /^join$/i });
  await Promise.race([join.waitFor().catch(() => {}), self(page).waitFor({ timeout: 30_000 })]);
  if (await join.isVisible()) await join.click();
  await expect(self(page)).toHaveCount(1, { timeout: 15_000 });
}

// Walk up to the machine (a click on the cabinet walks to its front) until its Insert Coin bubble shows. The front is
// wide enough for two side by side, but a walk ends beside anyone already standing where it aims: `at` picks the
// spot across the cabinet (0 its left edge, 1 its right) so two people can stand at it at once.
// A popover still open (the owner's Shared hint after a share) takes the first click, so the click is tried again.
async function walkUp(page: Page, at = 0.5): Promise<void> {
  await expect(async () => {
    const box = (await machine(page).boundingBox())!;
    await page.mouse.click(box.x + box.width * at, box.y + box.height * 0.85);
    await expect(press(page)).toBeVisible({ timeout: 6_000 });
  }).toPass({ timeout: 30_000 });
}

// Start a run and hop between the orbits until a letter scores (or the run ends), then close the panel, which ends
// the run and posts its score.
async function playUntilScored(page: Page): Promise<string> {
  await panel(page).getByRole('button', { name: 'Start' }).click();
  const score = panel(page).locator('[data-moon-mail-score]');
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowUp'];
  const deadline = Date.now() + 60_000;
  for (let i = 0; Date.now() < deadline; i++) {
    const text = (await score.textContent().catch(() => '0'))?.trim() ?? '0';
    if (text !== '0' && text !== '') break;
    if (await panel(page).getByText('Game Over').isVisible()) break;
    await page.keyboard.press(keys[i % keys.length]!);
    await page.waitForTimeout(450);
  }
  const posted = (await score.textContent())!.trim();
  expect(posted, 'a run that scored').not.toBe('0');
  await panel(page).getByRole('button', { name: 'Close' }).click();
  await expect(panel(page)).toHaveCount(0);
  return posted;
}

test("a Participant's score lands on the owner's machine and a Viewer's table, and an Editor's clear empties both", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const owner = await mintGuest(page.request);
  const ownerPage = await personIn(browser, baseURL!, owner);
  await ownerPage.goto(await serverNewUrl(ownerPage, `/new?template=${SPACE}`));
  await ownerPage.locator(CANVAS).waitFor({ timeout: 30_000 });
  await expect(self(ownerPage)).toHaveCount(1, { timeout: 15_000 });
  // A pad to arrive on and a machine above it, nothing in the way.
  await seedTab(ownerPage, [
    { id: 'pad', type: 'shape', shape: 'avatar-pad', x: 360, y: 420, width: 96, height: 64 },
    { id: MACHINE, type: 'shape', shape: 'arcade-machine', x: 376, y: 200, width: 64, height: 112 },
  ]);
  const id = new URL(ownerPage.url()).pathname.split('/').filter(Boolean).pop()!;
  const headers = await documentHeaders(page.request, owner, id, {
    Origin: new URL(baseURL!).origin,
  });
  const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers,
    data: { role: 'participate' },
  });
  expect(share.ok(), `share: ${share.status()}`).toBe(true);
  const code = ((await share.json()) as { link: { code: string } }).link.code;
  const viewCode = await legacyViewerLink(page.request, apiBase, id, headers);
  await ownerPage.reload();
  await ownerPage.locator(CANVAS).waitFor();
  await expect(self(ownerPage)).toHaveCount(1, { timeout: 15_000 });

  // The Participant plays and posts.
  const guestPage = await personIn(browser, baseURL!, null);
  await guestPage.goto(`/document/shared?s=${code}`);
  await joinIfAsked(guestPage);
  await walkUp(guestPage, 0);
  await expect(best(guestPage)).toHaveCount(0);
  await press(guestPage).click();
  await expect(panel(guestPage).getByRole('button', { name: 'Start' })).toBeVisible({
    timeout: 15_000,
  });
  const posted = await playUntilScored(guestPage);
  await expect(best(guestPage)).toContainText(`Best ${posted}`);
  const line = (await best(guestPage).textContent())!;

  // The owner, beside the Participant, sees the same best, then switches to Edit (its character leaves the floor).
  await walkUp(ownerPage, 1);
  await expect(best(ownerPage)).toHaveText(line, { timeout: 10_000 });
  await ownerPage.keyboard.press('e');
  await expect(self(ownerPage)).toHaveCount(0);

  // A Viewer sees the table, never the game.
  const viewerPage = await personIn(browser, baseURL!, null);
  await viewerPage.goto(`/document/shared?s=${viewCode}`);
  await joinIfAsked(viewerPage);
  await walkUp(viewerPage, 1);
  await press(viewerPage).click();
  await expect(panel(viewerPage).getByText('Viewers See the Scores')).toBeVisible({
    timeout: 15_000,
  });
  await expect(panel(viewerPage).getByRole('button', { name: 'Start' })).toHaveCount(0);
  await expect(panel(viewerPage).locator('[data-arcade-scores] li')).toHaveCount(1);
  await expect(panel(viewerPage).locator('[data-arcade-scores]')).toContainText(posted);
  await viewerPage.screenshot({ path: test.info().outputPath('viewer.png') });
  await expect(best(guestPage)).toHaveText(line);

  // The owner clears it from the element menu: Edit, a right-click on the machine, Tools, High Scores.
  await machine(ownerPage).click({ button: 'right' });
  await ownerPage.getByRole('button', { name: 'Tools', exact: true }).click();
  await ownerPage.getByRole('button', { name: 'High Scores', exact: true }).click();
  await ownerPage.getByText('1 Score on the table').waitFor();
  await ownerPage.getByRole('button', { name: 'Clear High Scores' }).click();
  const confirm = ownerPage.getByRole('alertdialog').or(ownerPage.getByRole('dialog'));
  await expect(confirm.getByText('Clear 1 score?')).toBeVisible();
  await confirm.getByRole('button', { name: 'Clear High Scores' }).click();

  // Empty everywhere: the Participant's bubble and the Viewer's open panel.
  await expect(best(guestPage)).toHaveCount(0, { timeout: 10_000 });
  await expect(panel(viewerPage).getByText('No Scores Yet')).toBeVisible({ timeout: 10_000 });

  await ownerPage.context().close();
  await guestPage.context().close();
  await viewerPage.context().close();
});
