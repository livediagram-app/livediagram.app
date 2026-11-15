import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

// The editor's tab title ("<plan> | liveplanner") went back to the bare "liveplanner" once Next.js committed the
// route's metadata title after hydration: the editor route holds it with this hook, never a one-off assignment.
describe('the editor route’s tab title', () => {
  it('is held with useBrowserTabTitle, never set with document.title', () => {
    const dir = `${__dirname}/`;
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const assigning = files.filter((f) => /document.title\s*=/.test(readFileSync(dir + f, 'utf8')));
    expect(assigning).toEqual([]);
    expect(readFileSync(`${dir}editor-page.tsx`, 'utf8')).toMatch(/useBrowserTabTitle\(/);
  });
});
