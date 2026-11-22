import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { nameOpenPage, openPageId, titleOf, writeLines } from '../knowledgebase';
import { asPerson, savedWith, signedInKnowledgebase, type Person } from './knowledge-session';

// A page's cover (docs/specs/030-knowledgebase/page-surface.md "The cover"; blueprints/page-surface.md "Testing"):
// an Editor adds one from the meta row, an agent sets a picture, the Editor repositions it and removes it; an animated
// cover moves, stands still under Reduce Motion and is recoloured by the Knowledgebase Style; and an agent's write
// shows as AI Edited in the meta row (verification.md "Made by a person or an agent"). The stack has no
// media service, so the picture's bytes are served to the page by the test.

test.use({ viewport: { width: 1440, height: 860 } });

const band = (page: Page) => page.locator('[data-page-cover]');
const addCover = (page: Page) => page.getByRole('button', { name: /^Add Cover/ });
const PICTURE_ID = '7c1e3f2a-5b6d-4e8f-9a0b-1c2d3e4f5a6b';

/** A tall picture (it overflows the band, so it has somewhere to move), drawn in the page and handed back as a PNG. */
async function tallPicture(page: Page): Promise<Buffer> {
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 1200;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 1200);
    grad.addColorStop(0, '#0ea5e9');
    grad.addColorStop(1, '#f97316');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1200, 1200);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  return Buffer.from(data, 'base64');
}

/** An agent's token for `who`, allowed to write in the knowledgebase as an Editor's Allow Writing does. */
async function writingAgent(page: Page, who: Person, id: string): Promise<Record<string, string>> {
  const minted = await page.request.post('/e2e/accounts/__seed/token', {
    data: { userId: who.id, email: who.email, name: 'agent' },
  });
  expect(minted.ok()).toBe(true);
  const token = (await minted.json()) as { id: string; secret: string };
  const granted = await page.request.put(`/api/documents/${id}/agents/${token.id}/scopes`, {
    headers: await asPerson(page, who, id),
    data: { scopes: ['read', 'suggest', 'write'] },
  });
  expect(granted.ok()).toBe(true);
  return {
    Authorization: `Bearer ${token.secret}`,
    'X-Liveknowledge-Agent': 'Coding Agent',
    'Content-Type': 'application/json',
  };
}

const focusOf = (page: Page) =>
  page
    .locator('[data-page-cover] img')
    .evaluate((img) => (img as HTMLImageElement).style.objectPosition);

test('an Editor adds a cover, repositions its picture and removes it', async ({
  page,
  pageErrors,
}) => {
  test.setTimeout(120_000);
  const { who, id } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  const tab = openPageId(page);
  const titleTop = (await titleOf(page).boundingBox())!.y;

  // A gradient from Add Cover, after the reading time: the band stands 220 px tall, and the page moves under it, its
  // blank top margin tucked under the band so the Title stands 36 px below it (page-surface.md "Under the band").
  await expect(addCover(page)).toBeVisible();
  const gradientSaved = savedWith(page, '"cover"');
  await addCover(page).click();
  await page
    .getByRole('dialog', { name: 'Add Cover' })
    .getByRole('button', { name: 'Theme Dusk' })
    .click();
  await gradientSaved;
  await expect(band(page)).toHaveAttribute('data-page-cover', 'gradient');
  expect((await band(page).boundingBox())!.height).toBe(220);
  await expect(addCover(page)).toHaveCount(0);
  await expect
    .poll(async () => {
      const cover = (await band(page).boundingBox())!;
      return Math.round((await titleOf(page).boundingBox())!.y - (cover.y + cover.height));
    })
    .toBe(36);
  expect((await titleOf(page).boundingBox())!.y).toBeGreaterThan(titleTop);

  // A picture from an agent reaches the open page as it lands.
  const picture = await tallPicture(page);
  await page.route(`**/api/images/${PICTURE_ID}*`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: picture }),
  );
  const set = await page.request.put(`/api/documents/${id}/pages/${tab}`, {
    headers: await writingAgent(page, who, id),
    data: { cover: { kind: 'image', imageId: PICTURE_ID } },
  });
  expect(set.status()).toBe(200);
  await expect(band(page)).toHaveAttribute('data-page-cover', 'picture');
  await expect(band(page).locator('img')).toHaveClass(/opacity-100/);
  expect(await focusOf(page)).toBe('50% 50%');

  // Reposition: drag the picture down, which shows more of its top, then Save Position.
  await band(page).hover();
  await page.getByRole('button', { name: 'Reposition' }).click();
  await expect(page.getByText('Drag the picture to reposition')).toBeVisible();
  const box = (await band(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 160, { steps: 6 });
  await page.mouse.up();
  const moved = await focusOf(page);
  expect(Number(moved.split(' ')[1]!.replace('%', ''))).toBeLessThan(50);
  const positioned = savedWith(page, '"focus"');
  await page.getByRole('button', { name: 'Save Position' }).click();
  await positioned;
  expect(await focusOf(page)).toBe(moved);

  // Remove, then Undo from its toast, then remove for good.
  await band(page).hover();
  await page.getByRole('button', { name: 'Remove Cover' }).click();
  await expect(band(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo Removing the Cover' }).click();
  await expect(band(page)).toHaveAttribute('data-page-cover', 'picture');
  await band(page).hover();
  await page.getByRole('button', { name: 'Remove Cover' }).click();
  await expect(band(page)).toHaveCount(0);
  await expect(addCover(page)).toBeVisible();
  await expect
    .poll(async () => Math.round((await titleOf(page).boundingBox())!.y - titleTop))
    .toBe(0);
  expectNoPageErrors(pageErrors);
});

test('an animated cover moves in the theme, stands still under Reduce Motion, and follows the style', async ({
  page,
  pageErrors,
}) => {
  test.setTimeout(120_000);
  await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  await writeLines(page, 'Restart the queue worker with the blue lever.');

  const saved = savedWith(page, '"motion"');
  await addCover(page).click();
  await page.getByRole('radio', { name: 'Aurora' }).click();
  await saved;
  await expect(band(page)).toHaveAttribute('data-page-cover', 'animated');
  // The menu carries on from the band's Change Cover, for the colours.
  const menu = page.getByRole('dialog', { name: 'Change Cover' });
  await expect(menu).toBeVisible();
  const soft = savedWith(page, '"soft"');
  await menu.getByRole('radio', { name: 'Theme Soft' }).click();
  await soft;
  await page.keyboard.press('Escape');
  const part = band(page).locator('[data-page-motion] *').first();
  await expect
    .poll(() => part.evaluate((el) => getComputedStyle(el).animationPlayState))
    .toBe('running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => part.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // The Knowledgebase Style recolours it, with nothing written to the page.
  const lime = await band(page).evaluate((el) => el.style.background);
  // Knowledgebase Style opens from the footer's Style (page-surface.md "Knowledgebase Style").
  await page.getByRole('button', { name: 'Style', exact: true }).click();
  const style = page.getByRole('dialog', { name: 'Knowledgebase Style' });
  await style.getByRole('button', { name: /^Boardroom/ }).click();
  // Closing with a change asks first: the style is the whole knowledgebase's (page-surface.md "Confirming").
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Apply to Knowledgebase', exact: true }).click();
  await expect(style).toHaveCount(0);
  await expect.poll(() => band(page).evaluate((el) => el.style.background)).not.toBe(lime);
  await expect(band(page)).toHaveAttribute('data-page-cover', 'animated');
  expectNoPageErrors(pageErrors);
});

test("an agent's write shows as AI Edited, with its name in the card", async ({
  page,
  pageErrors,
}) => {
  const { who, id } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  const tab = openPageId(page);
  const url = page.url();
  // Made and last changed by a person: one pill says both.
  await expect(page.locator('[data-page-maker="both"]')).toHaveText('Human Authored');
  const agent = await writingAgent(page, who, id);
  // Nobody has the page open while the agent writes.
  await page.goto('/');
  const wrote = await page.request.put(`/api/documents/${id}/pages/${tab}`, {
    headers: agent,
    data: { markdown: 'Restart the queue worker with the green lever.' },
  });
  expect(wrote.status()).toBe(200);

  await page.goto(url);
  const edited = page.locator('[data-page-maker="updated"]');
  await expect(edited).toHaveAttribute('data-maker-kind', 'ai');
  await expect(edited).toHaveText('AI Edited');
  await expect(page.locator('[data-page-maker="created"]')).toHaveText('Human Generated');
  // Its hover card names the agent and the door: the pill is described by the card's words.
  await expect(edited).toHaveAccessibleDescription(
    /^Last edited by Coding Agent through the API, /,
  );
  await edited.hover();
  await expect(page.getByRole('tooltip')).toContainText('Coding Agent');
  expectNoPageErrors(pageErrors);
});
