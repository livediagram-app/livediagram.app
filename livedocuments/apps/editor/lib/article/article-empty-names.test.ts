import { describe, expect, it } from 'vitest';
import { articleSchema as s } from './article-schema';
import { emptyNameDecorations } from './article-plugins';

// docs/specs/007-editor/article-pages.md "Blocks": an empty heading or table header cell is named for a screen
// reader, so axe finds no empty-heading or empty-table-header.
const attrsOf = (d: unknown) => (d as { type: { attrs: Record<string, string> } }).type.attrs;
const para = (style: string, text?: string) =>
  s.nodes.paragraph.create({ style }, text ? s.text(text) : null);
const table = (headerText?: string) =>
  s.nodes.table.create({}, [
    s.nodes.table_row.create({}, [
      s.nodes.table_header.create({}, headerText ? s.text(headerText) : null),
      s.nodes.table_header.create({}, s.text('Kept')),
    ]),
    s.nodes.table_row.create({}, [
      s.nodes.table_cell.create(),
      s.nodes.table_cell.create({}, s.text('x')),
    ]),
  ]);

describe('empty headings and header cells', () => {
  it('names an empty heading for a writer and hides it from a reader', () => {
    const doc = s.nodes.doc.create({}, [para('title'), para('h2'), para('body'), para('h1', 'Hi')]);
    expect(emptyNameDecorations(doc, true).map(attrsOf)).toEqual([
      { 'aria-label': 'Title' },
      { 'aria-label': 'Heading 2' },
    ]);
    expect(emptyNameDecorations(doc, false).map(attrsOf)).toEqual([
      { 'aria-hidden': 'true' },
      { 'aria-hidden': 'true' },
    ]);
  });

  it('names an empty table header cell while the table is edited, and no other cell', () => {
    const doc = s.nodes.doc.create({}, [table()]);
    expect(emptyNameDecorations(doc, true).map(attrsOf)).toEqual([
      { 'aria-label': 'Column header' },
    ]);
    expect(emptyNameDecorations(s.nodes.doc.create({}, [table('Typed')]), true)).toEqual([]);
  });

  it('walks a 5000-block article well inside a keystroke budget', () => {
    const doc = s.nodes.doc.create(
      {},
      Array.from({ length: 5000 }, (_, i) => para(i % 10 === 0 ? 'h1' : 'body', i % 3 ? 'x' : '')),
    );
    const start = performance.now();
    emptyNameDecorations(doc, true);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
