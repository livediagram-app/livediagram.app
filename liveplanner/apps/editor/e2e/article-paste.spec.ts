import { expect, expectNoPageErrors, test } from './fixtures';

// Pasting into an article (docs/specs/016-platform/trusted-types.md, "ProseMirror (the article editor)"): the editor
// parses the clipboard's HTML through its own ProseMirrorClipboard policy. It used to ask the page's `default` policy
// first, which refuses HTML, so a rich paste from anywhere (a web page, a project, another article) pasted nothing
// and logged a refusal. Only a real page with the enforced header shows it, hence an end-to-end test.
test('a rich paste into an article keeps its text and formatting', async ({ page, pageErrors }) => {
  await page.goto('/new?template=article');
  const editor = page.locator('.ProseMirror').first();
  await editor.waitFor({ timeout: 30_000 });
  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData(
      'text/html',
      '<meta charset="utf-8"><p>Pasted <strong>in bold</strong> and <em>italic</em></p>',
    );
    data.setData('text/plain', 'Pasted in bold and italic');
    document.activeElement?.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(editor.locator('strong', { hasText: 'in bold' })).toBeVisible();
  await expect(editor.locator('em', { hasText: 'italic' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
