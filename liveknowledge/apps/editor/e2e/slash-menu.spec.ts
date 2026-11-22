import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';
import { newKnowledgebase, writeLines, writing } from './knowledgebase';

// The slash menu (docs/specs/030-knowledgebase/page-surface.md "The slash menu"): its groups and preview, loose
// filtering with the letters bold, the keys (Tab between groups, Enter, Escape), Recent, and the phone's sheet. Only
// the real writing, its keys and the menu's placement show these together.

const menu = (page: Page) => page.getByRole('listbox', { name: 'Insert a block' });
const highlighted = (page: Page) => menu(page).locator('[role="option"][aria-selected="true"]');

async function openMenu(page: Page): Promise<void> {
  await newKnowledgebase(page);
  await page.keyboard.type('Slash');
  await writeLines(page, 'First line');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  await expect(menu(page)).toBeVisible();
}

test('opens under the `/` with its groups and a preview of the highlighted block', async ({
  page,
  pageErrors,
}) => {
  await openMenu(page);
  await expect(menu(page).getByRole('group')).toHaveCount(5);
  await expect(highlighted(page)).toHaveAttribute('data-slash-id', 'text');
  await expect(page.locator('[data-slash-preview="text"]')).toBeVisible();
  // The writing points at the highlighted entry, the caret staying in it.
  await expect(writing(page)).toBeFocused();
  const active = await writing(page).getAttribute('aria-activedescendant');
  expect(active).toBe(await highlighted(page).getAttribute('id'));
  // Under the `/`, inside the window.
  const box = (await page.locator('[data-slash-menu]').boundingBox())!;
  const caret = await page.evaluate(() => {
    const r = getSelection()!.getRangeAt(0).getBoundingClientRect();
    return { bottom: r.bottom, left: r.left };
  });
  expect(box.y).toBeGreaterThan(caret.bottom);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expectNoPageErrors(pageErrors);
});

test('Tab jumps between groups, arrows move, Escape closes', async ({ page, pageErrors }) => {
  await openMenu(page);
  await page.keyboard.press('Tab');
  await expect(highlighted(page)).toHaveAttribute('data-slash-id', 'bullet');
  await expect(page.locator('[data-slash-preview="bullet"]')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(highlighted(page)).toHaveAttribute('data-slash-id', 'text');
  await page.keyboard.press('ArrowDown');
  await expect(highlighted(page)).toHaveAttribute('data-slash-id', 'h1');
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await expect(writing(page)).toContainText('/');
  expectNoPageErrors(pageErrors);
});

test('filters loosely as you type, the letters bold, and Enter puts the block in', async ({
  page,
  pageErrors,
}) => {
  await openMenu(page);
  await page.keyboard.type('hd2');
  await expect(highlighted(page)).toHaveAttribute('data-slash-id', 'h2');
  await expect(highlighted(page).locator('b')).toHaveText(['H', 'd', '2']);
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeHidden();
  await page.keyboard.type('Section');
  await expect(writing(page).locator('[data-article-style="h2"]')).toHaveText('Section');
  // Nothing matching says so.
  await page.keyboard.press('Enter');
  await page.keyboard.type('/qqqq');
  await expect(page.getByRole('status').filter({ hasText: 'qqqq' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('Recent heads the menu with what was picked', async ({ page, pageErrors }) => {
  await openMenu(page);
  await page.keyboard.type('divi');
  await page.keyboard.press('Enter');
  await expect(writing(page).locator('.article-divider')).toHaveCount(1);
  await page.keyboard.type('/');
  const recent = menu(page).getByRole('group', { name: 'Recent' });
  await expect(recent.getByRole('option')).toHaveText([/^Divider/]);
  await expect(highlighted(page)).toHaveAttribute('data-slash-id', 'divider');
  expectNoPageErrors(pageErrors);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('is a sheet along the foot with 44 px entries and no preview', async ({
    page,
    pageErrors,
  }) => {
    await openMenu(page);
    const sheet = page.locator('[data-slash-menu="sheet"]');
    await expect(sheet).toBeVisible();
    await expect(page.locator('[data-slash-preview]')).toHaveCount(0);
    const option = (await highlighted(page).boundingBox())!;
    expect(option.height).toBeGreaterThanOrEqual(44);
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(390 - 8 + 0.5);
    expectNoPageErrors(pageErrors);
  });
});
