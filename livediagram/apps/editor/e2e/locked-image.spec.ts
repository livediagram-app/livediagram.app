import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, seedTab, startBlankDocument, test } from './fixtures';

// docs/specs/009-elements/images.md "Locked images": a lock holds an image's place, not its picture. A locked
// image, or any image on a locked tab, keeps Select Image and the pick lands; and a locked tab marks its lock once,
// on the tab, not with a padlock on every element (docs/specs/008-canvas/canvas-and-palette.md "Locking").

const PNG = fileURLToPath(
  new URL('../lib/__fixtures__/excalidraw-export.excalidraw.png', import.meta.url),
);

const emptyImage = (id: string, x: number, locked = false) => ({
  id,
  type: 'image',
  imageId: null,
  x,
  y: 200,
  width: 320,
  height: 240,
  ...(locked ? { locked: true } : {}),
});

// Select Image on the element's empty face, upload a picture in the picker, and wait for it to land.
async function pickPicture(page: Page, id: string) {
  const box = page.locator(`[data-element-id="${id}"]`);
  await box.getByRole('button', { name: 'Select Image' }).click();
  const picker = page.getByRole('dialog', { name: 'Image picker' });
  await picker.locator('input[type="file"]').first().setInputFiles(PNG);
  await expect(picker).toBeHidden();
  await expect(box.locator('img')).toHaveCount(1);
}

test('a locked image still takes a picture, and keeps its padlock', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await seedTab(page, [emptyImage('img', 300, true)]);
  const box = page.locator('[data-element-id="img"]');
  await expect(box.locator('[data-lock-badge]')).toHaveCount(1);
  await pickPicture(page, 'img');
  await expect(box.locator('[data-lock-badge]')).toHaveCount(1);
  expectNoPageErrors(pageErrors);
});

test('a locked tab shows no padlock on its elements, and its images still take a picture', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await seedTab(page, [emptyImage('img', 300)]);
  await page.getByRole('button', { name: 'Tab menu' }).click();
  await page.getByRole('button', { name: 'Lock Tab' }).click();
  await page.keyboard.press('Escape');
  const box = page.locator('[data-element-id="img"]');
  await expect(box.locator('[data-lock-badge]')).toHaveCount(0);
  await pickPicture(page, 'img');
  // Still locked: the picture was the one edit the tab took, so the box stays where it was.
  const before = await box.boundingBox();
  await page.mouse.move(before!.x + 40, before!.y + 40);
  await page.mouse.down();
  await page.mouse.move(before!.x + 140, before!.y + 90, { steps: 5 });
  await page.mouse.up();
  expect(await box.boundingBox()).toEqual(before);
  expectNoPageErrors(pageErrors);
});
