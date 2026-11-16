import { describe, expect, it } from 'vitest';
import { box, tab } from '../testing/review-fixtures';
import { REVIEW_MARKER } from './constants';
import { documentLink, reviewCommentText, type TabPictures } from './review-comment';
import type { DocumentReview, TabReview } from './review-diff';

// The pull request comment (docs/specs/027-repositories/blueprints/link-review.md "The comment", RL48).

const tabReview = (name: string, over: Partial<TabReview> = {}): TabReview => ({
  tabId: name,
  name,
  status: 'changed',
  before: tab(name, name, [box('a', 'A', 0)]),
  after: tab(name, name, [box('a', 'B', 0)]),
  added: [],
  changed: ['a'],
  removed: [],
  ...over,
});

const doc = (tabs: TabReview[], over: Partial<DocumentReview> = {}): DocumentReview => ({
  id: 'd1',
  name: 'Shop',
  host: 'https://www.livediagram.app',
  path: 'docs/shop.livediagram.json',
  status: 'changed',
  tabs,
  ...over,
});

const drawn = (tabs: TabReview[], p: TabPictures = { before: 'b.png', after: 'a.png' }) =>
  new Map(tabs.map((t) => [t, p]));

describe('reviewCommentText', () => {
  it('opens with the marker and says so in one line when nothing changed', () => {
    const c = reviewCommentText({ documents: [], pictures: new Map(), skipped: [] });
    expect(c).toEqual({
      text: `${REVIEW_MARKER}\n### Diagram changes\n\nNo diagram changes in this pull request.\n\n`,
      drawn: 0,
      listed: 0,
    });
  });

  it('draws each tab under its document’s link and file, pictures side by side at --image-url', () => {
    const flow = tabReview('Flow');
    const c = reviewCommentText({
      documents: [doc([flow])],
      pictures: drawn([flow]),
      skipped: [],
      imageUrl: 'https://x/pr-1/{file}?raw=true',
    });
    expect(c.text).toBe(
      [
        REVIEW_MARKER,
        '### Diagram changes',
        '',
        '1 tab changed in 1 document. Outlined: green solid is added, amber dashed is changed, red dotted is removed.',
        '',
        '#### Shop',
        '',
        '[Open in livediagram](https://www.livediagram.app/document/d1) · `docs/shop.livediagram.json`',
        '',
        '**Flow** · 0 added, 1 changed, 0 removed',
        '',
        '| Before | After |',
        '| --- | --- |',
        '| ![Flow before](https://x/pr-1/b.png?raw=true) | ![Flow after](https://x/pr-1/a.png?raw=true) |',
        '',
        '',
      ].join('\n'),
    );
    expect(c).toMatchObject({ drawn: 1, listed: 0 });
  });

  it('marks new and removed tabs and files, a missing side, placeholders, and escapes names', () => {
    const added = tabReview('New [one]', {
      status: 'added',
      before: null,
      after: tab('n', 'n', [
        { id: 'i', type: 'image', x: 0, y: 0, width: 10, height: 10 } as never,
      ]),
    });
    const removed = tabReview('Old', { status: 'removed', after: null });
    const c = reviewCommentText({
      documents: [
        doc([added], { status: 'added', name: '*Shop*' }),
        doc([removed], { status: 'removed', id: 'd2', host: 'http://evil.example' }),
      ],
      pictures: new Map([
        [added, { before: null, after: 'n.png' }],
        [removed, { before: 'o.png', after: null }],
      ]),
      skipped: [],
    });
    expect(c.text).toContain('#### \\*Shop\\*');
    expect(c.text).toContain('`docs/shop.livediagram.json` · new file');
    expect(c.text).toContain(
      '**New \\[one\\]** · 0 added, 1 changed, 0 removed · new tab\n\nPictures on this tab are drawn as placeholders.',
    );
    expect(c.text).toContain('| (none) | ![New  one  after](n.png) |');
    expect(c.text).toContain('\n\n`docs/shop.livediagram.json` · file removed');
    expect(c.text).toContain('· tab removed');
    expect(c.text).toContain('| ![Old before](o.png) | (none) |');
    expect(c.text).not.toContain('evil');
  });

  it('lists tabs without pictures and files not drawn, and stays under the cap', () => {
    const tabs = Array.from({ length: 30 }, (_, i) => tabReview(`Tab ${i}`));
    const pictured = tabs.slice(0, 10);
    const c = reviewCommentText({
      documents: [doc(tabs)],
      pictures: drawn(pictured),
      skipped: [{ path: 'x.livediagram.json', reason: 'has conflict markers' }],
    });
    expect(c).toMatchObject({ drawn: 10, listed: 20 });
    expect(c.text).toContain(
      '<details><summary>20 more tabs not drawn</summary>\n\n- Shop · Tab 10 · 0 added, 1 changed, 0 removed\n',
    );
    expect(c.text).toContain(
      '\n</details>\n\nNot drawn:\n\n- `x.livediagram.json` (has conflict markers)\n',
    );
    const small = reviewCommentText({
      documents: [doc(tabs)],
      pictures: drawn(pictured),
      skipped: Array.from({ length: 50 }, (_, i) => ({ path: `f${i}`, reason: 'invalid' })),
      max: 1500,
    });
    expect(small.text.length).toBeLessThanOrEqual(1500);
    expect(small.drawn).toBeLessThan(10);
    expect(small.text).toMatch(/- and \d+ more\n/);
    const one = reviewCommentText({
      documents: [doc([tabs[0]!])],
      pictures: new Map(),
      skipped: [],
    });
    expect(one.text).toContain('<summary>1 more tab not drawn</summary>');
  });
});

describe('documentLink', () => {
  it('links an https host, with or without a path, and nothing else', () => {
    expect(documentLink('https://www.livediagram.app', 'a b')).toBe(
      'https://www.livediagram.app/document/a%20b',
    );
    expect(documentLink('https://example.com/diagrams/', 'd')).toBe(
      'https://example.com/diagrams/document/d',
    );
    expect(documentLink('https://example.com/diagrams', 'd')).toBe(
      'https://example.com/diagrams/document/d',
    );
    expect(documentLink('javascript:alert(1)', 'd')).toBeNull();
    expect(documentLink('not a url', 'd')).toBeNull();
  });
});
