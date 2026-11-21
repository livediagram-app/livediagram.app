import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';
import {
  expectCaretInTitle,
  expectNoSidewaysScroll,
  newKnowledgebase,
  paragraphs,
  titleOf,
} from './knowledgebase';

// A knowledgebase on a phone (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree": "On a phone
// the tree is a sheet opened from a Pages button"): the sheet, a row opening its page, writing with a finger, the
// four views within reach, and no view scrolling sideways. A guest's knowledgebase, kept Offline; Home's phone
// width is signed-in/knowledge-audit.spec.ts's.

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});

// The phone's keyboard put away (its Done key): the writing lets go of the caret, as it does on a phone.
const putKeyboardAway = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

test('the Pages sheet opens, a row opens its page, and writing works', async ({
  page,
  pageErrors,
}) => {
  await newKnowledgebase(page);
  await page.keyboard.type('Handbook');
  // No sidebar on a phone: the tree is a sheet.
  await expect(page.getByRole('complementary', { name: 'Pages' })).toHaveCount(0);
  // While the caret is in the writing its bar has the top row; with the caret gone the row's own buttons are back.
  const pagesButton = page.getByRole('button', { name: 'Pages', exact: true });
  await expect(page.locator('[data-page-toolbar]')).toBeVisible();
  await expect(pagesButton).toBeHidden();
  await putKeyboardAway(page);
  await expect(page.locator('[data-page-toolbar]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
  await pagesButton.tap();
  const sheet = page.getByRole('dialog', { name: 'Pages' });
  await expect(sheet.getByRole('treeitem', { name: 'Handbook', exact: true })).toBeVisible();

  // A new page from the sheet takes the caret in its Title.
  await sheet.getByRole('button', { name: 'New Page' }).tap();
  await expectCaretInTitle(page);
  await page.keyboard.type('Expenses');
  await page.keyboard.press('Enter');
  await page.keyboard.type('File receipts by Friday.');
  await expect(paragraphs(page).first()).toHaveText('File receipts by Friday.');

  // A row opens its page, and the sheet gets out of the way.
  if (!(await sheet.isVisible())) {
    await putKeyboardAway(page);
    await pagesButton.tap();
  }
  const rows = sheet.getByRole('treeitem');
  await expect(rows).toHaveCount(2);
  // Rows are finger sized.
  expect((await rows.first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await sheet.getByRole('treeitem', { name: 'Handbook', exact: true }).tap();
  await expect(titleOf(page)).toHaveText('Handbook');
  await expect(sheet).toBeHidden();

  // A tap in the writing puts the caret there, and typing lands there.
  const first = paragraphs(page).first();
  const box = (await first.boundingBox())!;
  await page.touchscreen.tap(box.x + 8, box.y + box.height / 2);
  await page.keyboard.type('Welcome.');
  await expect(first).toHaveText('Welcome.');
  await expect(titleOf(page)).toHaveText('Handbook');
  await expectNoSidewaysScroll(page, 'Pages');
  expectNoPageErrors(pageErrors);
});

test('the view switch is within reach, and no view scrolls sideways', async ({
  page,
  pageErrors,
}) => {
  await newKnowledgebase(page);
  const views = page.getByRole('navigation', { name: 'Knowledgebase Views' });
  for (const view of ['Pages', 'Ask', 'AI Knowledge', 'Connect']) {
    const link = views.getByRole('link', { name: view, exact: true });
    await expect(link).toBeInViewport({ ratio: 1 });
    const box = (await link.boundingBox())!;
    expect(box.height, `${view} is a finger's height`).toBeGreaterThanOrEqual(40);
  }
  await expectNoSidewaysScroll(page, 'Pages');

  await views.getByRole('link', { name: 'Ask', exact: true }).tap();
  await expect(
    page.getByRole('heading', { name: 'No Ask in an Offline Knowledgebase' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page, 'Ask');

  await views.getByRole('link', { name: 'AI Knowledge', exact: true }).tap();
  await expect(
    page.getByRole('heading', { name: 'No AI Knowledge in an Offline Knowledgebase' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page, 'AI Knowledge');

  await views.getByRole('link', { name: 'Pages', exact: true }).tap();
  await expect(titleOf(page)).toBeVisible();
  expectNoPageErrors(pageErrors);
});
