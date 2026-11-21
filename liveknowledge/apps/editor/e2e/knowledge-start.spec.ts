import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';
import { expectCaretInTitle, startScreen, titleOf, treeShape } from './knowledgebase';

// The start screen a new knowledgebase opens on (docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"; blueprints/describe-to-set-up.md): shapes of a whole knowledgebase. Blank Knowledgebase first, then the
// structures, each making its whole page tree, and Import at the rail's foot (Describe to Set Up is
// signed-in/knowledge-setup.spec.ts's). Each choice closes it for good.

async function openNew(page: Page) {
  await page.goto('/new');
  await page.waitForURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const start = startScreen(page);
  await expect(start).toBeVisible({ timeout: 30_000 });
  return start;
}

test('a new knowledgebase opens on its start, which a reload keeps, and Blank Knowledgebase closes into Start Here', async ({
  page,
  pageErrors,
}) => {
  const start = await openNew(page);
  // Start leads, Blank Knowledgebase its first card; no other kind of page is offered.
  await expect(start.locator('[data-rail]').first()).toHaveAttribute('data-rail', 'start');
  await expect(start.locator('[data-start-card]').first()).toContainText('Blank Knowledgebase');
  await expect(start.getByText(/Blank (Slide|Infographic|Canvas)/)).toHaveCount(0);
  // It is offered until a choice: a reload still opens on it.
  await page.reload();
  await expect(startScreen(page)).toBeVisible({ timeout: 30_000 });

  await startScreen(page)
    .getByRole('button', { name: /^Blank Knowledgebase:/ })
    .click();
  await expect(startScreen(page)).toHaveCount(0);
  expect(await treeShape(page)).toEqual(['1 Start Here']);
  await expectCaretInTitle(page);
  // Chosen once: a reload opens on the page.
  await page.reload();
  await titleOf(page).waitFor({ timeout: 30_000 });
  await expect(startScreen(page)).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('a structure from the start makes its whole page tree, and Import opens the import dialog', async ({
  page,
  pageErrors,
}) => {
  const start = await openNew(page);
  // Each structure shows its outline and page count.
  await start.locator('[data-rail="engineering"]').click();
  const handbook = start.locator('[data-start-card="engineering-handbook"]');
  await expect(handbook).toContainText('13 Pages');
  await expect(handbook).toContainText('Shipping: Release Process, On-Call');
  await handbook.click();
  await expect(startScreen(page)).toHaveCount(0);
  // Its tree, Start Here become its first page, which is open.
  await expect
    .poll(() => treeShape(page))
    .toEqual([
      '1 Overview',
      '1 Architecture',
      '2 Services',
      '2 Data',
      '2 Decisions',
      '1 Development',
      '2 Local Setup',
      '2 Code Style',
      '2 Code Review',
      '2 Testing',
      '1 Shipping',
      '2 Release Process',
      '2 On-Call',
    ]);
  await expect(titleOf(page)).toHaveText('Overview');
  await expect(page.locator('.article-flow')).toContainText('Where to Start');
  await expect(page.locator('[data-knowledgebase-name]:visible').first()).toHaveText(
    'Engineering Handbook',
  );

  // A second new knowledgebase: its Import closes the start and opens the dialog over the empty page.
  const second = await openNew(page);
  await second.locator('[data-rail="import"]').click();
  await expect(startScreen(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Import Into Page' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the start fills the screen and Blank Knowledgebase closes into the page', async ({
    page,
    pageErrors,
  }) => {
    const start = await openNew(page);
    const box = (await start.boundingBox())!;
    expect(box.width).toBeGreaterThan(350);
    await start.getByRole('button', { name: /^Blank Knowledgebase:/ }).tap();
    await expect(startScreen(page)).toHaveCount(0);
    await expect(titleOf(page)).toBeVisible();
    expectNoPageErrors(pageErrors);
  });
});
