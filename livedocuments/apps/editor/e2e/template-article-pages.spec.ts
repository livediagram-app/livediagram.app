import { expect, expectNoPageErrors, test } from './fixtures';

// docs/specs/024-agents/pages-for-agents.md "Pages for the writing": a written template opens on one page, and the
// editor that opens it grows it to the pages its writing needs. Measured on one page, a footnote or a repeated table
// header on a page not there yet takes no room, so the first grow can land a page short (the Research Report's
// Limitations cut off) or a page over (an empty last page under the Case Study). The grow settles what it added on the
// real pages, so each opens on exactly the pages it fills.
const PAGES = { 'research-report': 4, 'case-study': 2 } as const;

for (const [kind, pages] of Object.entries(PAGES)) {
  test(`${kind} opens on the ${pages} pages its writing fills`, async ({ page, pageErrors }) => {
    await page.goto(`/new?template=${kind}`);
    await page.locator('.ProseMirror').first().waitFor({ timeout: 30_000 });
    const rows = page.locator('button[data-page-row]');
    await expect(rows).toHaveCount(pages, { timeout: 15_000 });
    // And stays there: no later lay-out adds or drops one.
    await page.waitForTimeout(2_000);
    await expect(rows).toHaveCount(pages);
    expectNoPageErrors(pageErrors);
  });
}
