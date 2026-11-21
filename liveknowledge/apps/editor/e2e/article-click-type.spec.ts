import { expect, expectNoPageErrors, test } from './fixtures';
import { ensureEditing } from './knowledgebase';

// A click into a paragraph, then typing (docs/specs/007-editor/article-pages.md "Writing"): the words land where the
// caret went and every letter already there stays (Work Tracker 1232, where a paragraph's first letters "Ever" were
// once seen gone after a click and typing). Each paragraph is clicked at its first letters, the riskiest spot, and
// the next click follows the typing at once, so a commit still pending from the last paragraph races it.
test('a click into a paragraph and typing keeps the whole paragraph', async ({
  page,
  pageErrors,
}) => {
  await page.goto('/new?template=article');
  const bodies = page.locator('.ProseMirror p.article-body');
  await bodies.first().waitFor({ timeout: 30_000 });
  // A template's page opens to read (docs/specs/030-knowledgebase/editing.md): Edit, then the click and typing.
  await ensureEditing(page);
  const count = Math.min(await bodies.count(), 3);
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const body = bodies.nth(i);
    const before = (await body.textContent()) ?? '';
    const box = await body.boundingBox();
    if (!box) throw new Error(`paragraph ${i} has no box`);
    await page.mouse.click(
      box.x + 3,
      box.y + box.height / 2 - (box.height > 30 ? box.height / 3 : 0),
    );
    await page.keyboard.type(`W${i}_`);
    const after = (await body.textContent()) ?? '';
    expect(after).toContain(`W${i}_`);
    expect(after.replace(`W${i}_`, '')).toBe(before);
  }
  // And still whole once the typing has been committed.
  await page.waitForTimeout(1500);
  for (let i = 0; i < count; i++) {
    const text = (await bodies.nth(i).textContent()) ?? '';
    expect(text).toContain(`W${i}_`);
  }
  expectNoPageErrors(pageErrors);
});
