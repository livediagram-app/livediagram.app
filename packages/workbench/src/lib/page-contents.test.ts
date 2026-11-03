import { describe, expect, it } from 'vitest';
import { filterContents, pageInView, type ContentsRowBase } from './page-contents';

// docs/specs/007-editor/pages-mode.md "Contents": Find a Page and the page in view, as every editor
// with pages reads them. Each editor's own rows are tested beside its contentsRows.
const row = (id: string, number: number, name: string, line: string): ContentsRowBase => ({
  id,
  number,
  name,
  line,
  locked: false,
  aspect: 1,
});
const rows = [
  row('a', 1, 'Cover', 'Infographic · A4 Portrait'),
  row('b', 2, 'Page 2', 'Slide · In the deck'),
  row('c', 3, 'Ｆｉｅｌｄ Notes', 'Article'),
];

describe('filterContents', () => {
  it('keeps the rows holding every word, in their name, line or number', () => {
    expect(filterContents(rows, 'cover portrait').map((r) => r.id)).toEqual(['a']);
    expect(filterContents(rows, '2').map((r) => r.id)).toEqual(['b']);
    expect(filterContents(rows, '   ')).toHaveLength(3);
    expect(filterContents(rows, 'nothing')).toEqual([]);
  });

  it('folds case and width, as the editor’s find does', () => {
    expect(filterContents(rows, 'FIELD').map((r) => r.id)).toEqual(['c']);
  });

  it('searches the words on each page when it has them', () => {
    const texts = new Map([['b', 'Quarterly revenue']]);
    expect(filterContents(rows, 'revenue', texts).map((r) => r.id)).toEqual(['b']);
  });
});

describe('pageInView', () => {
  // Three 100 x 100 pages in a row, 50 apart.
  const pages = ['a', 'b', 'c'].map((id, i) => ({
    id,
    rect: { x: i * 150, y: 0, width: 100, height: 100 },
  }));
  const screen = { width: 1000, height: 800 };
  // The centred transform (lib/viewport.ts): the screen's middle shows canvas (cx, cy).
  const at = (cx: number, cy: number, zoom = 1) => ({
    zoom,
    offset: { x: screen.width / 2 - cx, y: screen.height / 2 - cy },
  });

  it('is the page holding the middle of the screen, else the nearest', () => {
    expect(pageInView(pages, at(200, 50), screen)).toBe('b');
    expect(pageInView(pages, at(390, 400), screen)).toBe('c');
    expect(pageInView([], at(0, 0), screen)).toBeUndefined();
  });

  it('reads the middle of what shows beside a docked sidebar', () => {
    // A 600 px sidebar on the left moves the middle 300 px right on screen: 300 canvas px at zoom 1.
    expect(pageInView(pages, at(0, 50), screen, { left: 600, right: 0 })).toBe('c');
    expect(pageInView(pages, at(300, 50), screen, { left: 0, right: 600 })).toBe('a');
  });
});
