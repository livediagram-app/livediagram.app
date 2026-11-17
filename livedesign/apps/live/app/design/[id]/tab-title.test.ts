import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { notFoundTitle } from '@liveworkspace/workbench/lib/not-found-reason';

// offline-mode.md "The tab title": a warm open named the design before the not-found route's metadata title
// committed, and the tab went back to the bare "livedesign". The editor route holds the title with useBrowserTabTitle.
describe('the editor route’s tab title', () => {
  it('is held with useBrowserTabTitle, never set with document.title', () => {
    const dir = `${__dirname}/`;
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const assigning = files.filter((f) => /document.title\s*=/.test(readFileSync(dir + f, 'utf8')));
    expect(assigning).toEqual([]);
    expect(readFileSync(`${dir}editor-page.tsx`, 'utf8')).toMatch(/useBrowserTabTitle\(/);
  });
});

// A design that doesn't exist (or isn't yours) must never leave the tab reading "Untitled design", nor pin a #t= tab
// that was never loaded (docs/specs/007-editor/new-design-route.md "Tab title"). The hash half lives in
// @liveworkspace/workbench's useTabEntryEffects ("pins no tab until its content has loaded"); this holds the title half:
// every status screen names itself through a `status` holder, and the not-found one is titled by its reason.
describe('the editor route’s status screens', () => {
  const page = readFileSync(`${__dirname}/editor-page.tsx`, 'utf8');

  it('title the tab with a status holder, so the placeholder design name never shows', () => {
    expect(page).toMatch(/useBrowserTabTitle\(`\$\{title\} \| livedesign`, \{ status: true \}\)/);
    expect(page).toMatch(
      /useBrowserTabTitle\(title \? `\$\{title\} \| livedesign` : null, \{ status: true \}\)/,
    );
  });

  it('name the missing design and an unknown address by the not-found reason, not by the design name', () => {
    expect(page).toMatch(/<StatusShell title=\{notFoundTitle\(reason, 'design'\)\}>/);
    expect(notFoundTitle('missing', 'design')).toBe('Design Not Found');
    expect(notFoundTitle('page', 'design')).toBe('Page Not Found');
  });
});
