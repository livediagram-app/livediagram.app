import type { Locator, Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';
import {
  ensureEditing,
  expectCaretInTitle,
  expectNoSidewaysScroll,
  newKnowledgebase,
  paragraphs,
  saveAndGoOn,
  titleOf,
  writing,
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

// A finger held on a control past the hint's long press (packages/ui hint/useHint.ts), then lifted.
async function longPress(page: Page, target: Locator): Promise<void> {
  const box = (await target.boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

// A control that has stopped moving: in view, and the same box on two frames running (a sheet slides in, and a tap on
// a row mid-slide lands on whatever is under the finger by then).
async function settled(target: Locator): Promise<void> {
  await expect(target).toBeInViewport({ ratio: 1 });
  await expect
    .poll(async () =>
      target.evaluate(
        (el) =>
          new Promise<boolean>((done) => {
            const box = () => JSON.stringify(el.getBoundingClientRect());
            const before = box();
            requestAnimationFrame(() => requestAnimationFrame(() => done(box() === before)));
          }),
      ),
    )
    .toBe(true);
}

// The phone's keyboard put away (its Done key): the writing lets go of the caret, as it does on a phone.
const putKeyboardAway = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

test('the Pages sheet opens, a row opens its page, and writing works', async ({
  page,
  pageErrors,
}) => {
  await newKnowledgebase(page);
  await page.keyboard.type('Handbook');
  // The name is the draft's until Save (docs/specs/030-knowledgebase/editing.md); back in the writing after it.
  await saveAndGoOn(page);
  await writing(page).focus();
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
  await saveAndGoOn(page);

  // A row opens its page, and the sheet gets out of the way.
  if (!(await sheet.isVisible())) {
    await putKeyboardAway(page);
    await pagesButton.tap();
  }
  const rows = sheet.getByRole('treeitem');
  await expect(rows).toHaveCount(2);
  // Rows are finger sized.
  expect((await rows.first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const handbook = sheet.getByRole('treeitem', { name: 'Handbook', exact: true });
  await settled(handbook);
  await handbook.tap();
  await expect(titleOf(page)).toHaveText('Handbook');
  await expect(sheet).toBeHidden();

  // A page opens to read (editing.md "Read mode"): Edit, then a tap in the writing puts the caret there, and typing lands there.
  await ensureEditing(page);
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
  for (const view of ['Pages', 'Ask', 'Insights', 'Connect MCP']) {
    const link = views.getByRole('link', { name: view, exact: true });
    await expect(link).toBeInViewport({ ratio: 1 });
    const box = (await link.boundingBox())!;
    expect(box.height, `${view} is a finger's height`).toBeGreaterThanOrEqual(40);
  }
  await expectNoSidewaysScroll(page, 'Pages');

  // Kept Offline, Ask and Insights stay in the footer going nowhere; a long press says why and offers the sync
  // (docs/specs/030-knowledgebase/search-and-ask.md "Offline, in the footer").
  for (const view of ['Ask', 'Insights']) {
    const link = views.getByRole('link', { name: view, exact: true });
    await expect(link).toHaveAttribute('aria-disabled', 'true');
    // A tap goes nowhere: the page stays. (Playwright's tap() waits for an aria-disabled control to be enabled.)
    const at = (await link.boundingBox())!;
    await page.touchscreen.tap(at.x + at.width / 2, at.y + at.height / 2);
    await expect(titleOf(page)).toBeVisible();
    await expect(views.getByRole('link', { name: 'Pages', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await longPress(page, link);
    const card = page.getByRole('tooltip');
    await expect(card).toContainText(`${view} Needs Syncing`);
    await expect(card.getByRole('button', { name: 'Sync Knowledgebase' })).toBeVisible();
    await expectNoSidewaysScroll(page, view);
    await page.touchscreen.tap(195, 300);
    await expect(card).toHaveCount(0);
  }

  await views.getByRole('link', { name: 'Pages', exact: true }).tap();
  await expect(titleOf(page)).toBeVisible();
  expectNoPageErrors(pageErrors);
});
