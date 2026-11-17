import { expect, expectNoPageErrors, test } from './fixtures';

// A finger on an article paragraph (docs/specs/007-editor/article-pages.md "On a phone", Work Tracker 978): a tap
// puts the caret in the paragraph tapped, and what is typed next lands there, never in the Title. On a phone the
// writing taking the caret frames its page (readPage) as the tap lands, and adding an article asks for the caret in
// its Title (a focus request), so both are driven here: a plain tap, and a tap after Add Article. Only the real
// editor lays the writing out, hence an end-to-end test.
test.describe('article on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });

  const caretBlock = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const anchor = getSelection()?.anchorNode;
      const el = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element);
      const block = el?.closest?.('.article-flow > *');
      return block ? [...document.querySelectorAll('.article-flow > *')].indexOf(block) : -1;
    });

  // A block's place among every article's blocks, as caretBlock counts them.
  const indexOf = (block: import('@playwright/test').Locator) =>
    block.evaluate((b) => [...document.querySelectorAll('.article-flow > *')].indexOf(b));

  test('a tap on a paragraph puts the caret there, and typing lands there', async ({
    page,
    pageErrors,
  }) => {
    await page.goto('/new?template=article');
    const body = page.locator('.ProseMirror p.article-body').first();
    await body.waitFor({ timeout: 30_000 });
    const title = page.locator('.article-flow > *').first();
    const titleBefore = await title.textContent();
    const box = (await body.boundingBox())!;
    await page.touchscreen.tap(box.x + 8, box.y + box.height / 2);
    await expect.poll(() => caretBlock(page)).toBe(await indexOf(body));
    await page.keyboard.type('QQ');
    await expect(body).toContainText('QQ');
    await expect(title).toHaveText(titleBefore ?? '');
    expectNoPageErrors(pageErrors);
  });

  test("after Add Article puts the caret in the new article's Title, a tap on its paragraph takes it", async ({
    page,
    pageErrors,
  }) => {
    await page.goto('/new?template=article');
    await page.locator('.ProseMirror p.article-body').first().waitFor({ timeout: 30_000 });
    // Off screen on a phone until the view moves to it: pressed as a script would.
    await page
      .getByRole('button', { name: 'Add Article', exact: true })
      .first()
      .evaluate((b) => (b as HTMLElement).click());
    // The new article's Title has the caret (its focus request).
    const writing = page.locator('.article-flow.ProseMirror-focused');
    await expect(writing).toHaveCount(1);
    const title = writing.locator('> *:first-child');
    await expect.poll(() => caretBlock(page)).toBe(await indexOf(title));
    const paragraph = writing.locator('> *:nth-child(2)');
    // The view settles after the glide to the new page; tap the paragraph's part on screen.
    await expect.poll(async () => (await paragraph.boundingBox())?.x ?? 999).toBeLessThan(380);
    const box = (await paragraph.boundingBox())!;
    await page.touchscreen.tap(Math.max(box.x, 0) + 8, box.y + box.height / 2);
    await expect.poll(() => caretBlock(page)).toBe(await indexOf(paragraph));
    await page.keyboard.type('QQ');
    await expect(paragraph).toContainText('QQ');
    await expect(title).not.toContainText('QQ');
    expectNoPageErrors(pageErrors);
  });
});
