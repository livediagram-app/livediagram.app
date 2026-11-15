import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

// offline-mode.md "The tab title": a warm open named the item before the not-found route's metadata title committed,
// and the tab went back to the bare "livediagram". The editor route holds the title with useBrowserTabTitle.
describe('the editor route’s tab title', () => {
  it('is held with useBrowserTabTitle, never set with document.title', () => {
    const dir = `${__dirname}/`;
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const assigning = files.filter((f) => /document.title\s*=/.test(readFileSync(dir + f, 'utf8')));
    expect(assigning).toEqual([]);
    expect(readFileSync(`${dir}editor-page.tsx`, 'utf8')).toMatch(/useBrowserTabTitle\(/);
  });
});
