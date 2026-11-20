import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// docs/specs/007-editor/article-pages.md "Flowing onto pages" (Work Tracker 776): a table's header row is never left
// alone at a page's foot. The writing's columns are its pages; this sets a table under the article stylesheets in
// columns 400 px high and reads which column each row lands in, for every amount of writing above it. The header row
// and the first row under it always share a column, and a table that fits stays where it is. (WebKit, which does not
// honour the stylesheet's avoid between rows, is kept by the header-row pass: lib/article/article-table-layout.test.ts.)

const app = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const css = ['article-pages.css', 'article-tables.css']
  .map((f) => readFileSync(join(app, f), 'utf8'))
  .join('\n');

const article = (lines: number) => `<style>${css}</style>
<div class="article-flow" style="left:0;top:0;width:1000px;height:400px;column-width:300px;column-gap:50px;
  column-count:3;--article-size:16px;--article-leading:1.5;--article-para:1;--article-ink:#111;--article-accent:#c60">
  ${Array.from({ length: lines }, (_, i) => `<p class="article-block article-body">Line ${i + 1}</p>`).join('')}
  <table class="article-block article-table" data-header><tbody>
    <tr data-row-id="h"><th>Name</th><th>Notes</th></tr>
    <tr data-row-id="a"><td>One</td><td>a<br>b<br>c<br>d<br>e</td></tr>
    <tr data-row-id="b"><td>Two</td><td>f</td></tr>
  </tbody></table>
</div>`;

test('a header row moves to the next page with the row under it', async ({ page }) => {
  const kept: number[] = [];
  for (let lines = 1; lines <= 9; lines++) {
    await page.setContent(article(lines));
    const [header, first] = await page.evaluate(() =>
      [...document.querySelectorAll('tr')].map((tr) =>
        Math.floor(tr.getBoundingClientRect().left / 350),
      ),
    );
    expect(header, `${lines} lines above: the header row's page`).toBe(first);
    if (header === 0) kept.push(lines);
  }
  // A table that fits under the writing stays on its page (pagination without the case is unchanged), and the run
  // reached the case: with more writing above, the table moved on.
  expect(kept[0]).toBe(1);
  expect(kept.length).toBeLessThan(9);
  expect(kept).toEqual(kept.map((_, i) => i + 1));
});
