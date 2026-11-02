import { expect, expectNoPageErrors, test } from './fixtures';

// Undo in the writing (docs/specs/007-editor/article-pages.md "Commits"): ⌘Z first writes what was typed as its
// own step, then undoes it. The very first typing of a session used to stay: the host decides whether there is
// anything to undo from its last render, which had an empty history, so an undo pressed before the typing's idle
// commit found nothing. Only the real editor and its host show it, hence an end-to-end test.
test('undo straight after the first typing takes it back', async ({ page, pageErrors }) => {
  await page.goto('/new?template=article');
  const body = page.locator('.ProseMirror p.article-body').first();
  await body.waitFor({ timeout: 30_000 });
  const before = await body.textContent();
  await body.click();
  await page.keyboard.press('End');
  await page.keyboard.type('QQQ');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(body).toHaveText(before ?? '');
  // And redo brings it back.
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(body).toContainText('QQQ');
  expectNoPageErrors(pageErrors);
});
