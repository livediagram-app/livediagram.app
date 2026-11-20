import { expect, expectNoPageErrors, test } from './fixtures';

// A finger on an article paragraph (docs/specs/007-editor/article-pages.md "On a phone", Work Tracker 978): a tap
// puts the caret in the paragraph tapped, and what is typed next lands there, never in the Title. On a phone the
// writing taking the caret frames its page (readPage) as the tap lands. A tap after a new page took the caret in its
// Title is phone.spec.ts's. Only the real editor lays the writing out, hence an end-to-end test.
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
});
