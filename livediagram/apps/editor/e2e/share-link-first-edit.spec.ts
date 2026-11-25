import type { Page } from '@playwright/test';
import { CANVAS, freshDarkPage, seedDocument, shareLink } from './audit-screens';
import { expect, mintGuest, test } from './fixtures';

// From a share link to the first edit (liveworkspace/docs/specs/011-workbench/first-edit.md "A visitor's name"): a
// guest opens the item straight away under a defaulted name, with the Palette on screen and nothing to dismiss; the
// name tray offers Change Name (the name card) and Keep It, and either confirms the name for good in this browser.

const tray = (page: Page) => page.getByRole('status').filter({ hasText: /You.re .+ here/ });

test('a share link opens straight on the item, with the name one click away', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = await mintGuest(page.request);
  const origin = new URL(baseURL!).origin;
  const id = await seedDocument(page, owner, origin);
  const code = await shareLink(page, owner, origin, id);

  const visitor = await freshDarkPage(browser);
  await visitor.goto(`/document/shared?s=${code}`);
  await visitor.locator(CANVAS).waitFor();
  // Nothing stands in the way: the Palette is up, no card asks for a name.
  await expect(tray(visitor)).toBeVisible();
  await expect(visitor.getByRole('button', { name: 'Shapes' })).toBeVisible();
  await expect(visitor.getByRole('button', { name: /^join$/i })).toHaveCount(0);

  // Change Name opens the card; Join keeps the typed name, and the tray does not come back.
  await tray(visitor).getByRole('button', { name: 'Change Name' }).click();
  const field = visitor.getByRole('textbox', { name: 'Your name' });
  await field.fill('Ada Lovelace');
  await visitor.getByRole('button', { name: /^join$/i }).click();
  await expect(tray(visitor)).toHaveCount(0);
  await visitor.reload();
  await visitor.locator(CANVAS).waitFor();
  await expect(visitor.getByRole('button', { name: 'Shapes' })).toBeVisible();
  await expect(tray(visitor)).toHaveCount(0);
  await visitor.context().close();

  // Keep It confirms the name as it is.
  const other = await freshDarkPage(browser);
  await other.goto(`/document/shared?s=${code}`);
  await tray(other).getByRole('button', { name: 'Keep It' }).click();
  await expect(tray(other)).toHaveCount(0);
  await expect(other.getByRole('button', { name: /^join$/i })).toHaveCount(0);
  await other.context().close();
});
