import { describe, expect, it } from 'vitest';
import { book } from './testing/book';
import { renderWindow } from './engine/render';
import { HYPERLINK_URL_MAX, safeHyperlink } from './hyperlink';

// docs/specs/029-sheets/formulas.md "Text": HYPERLINK shows its label as a link; the target is kept only for http,
// https and mailto, so nothing else typed or imported can ever be opened.

describe('safeHyperlink', () => {
  it('keeps http, https and mailto targets', () => {
    expect(safeHyperlink('https://liveplanner.app')).toBe('https://liveplanner.app/');
    expect(safeHyperlink(' http://example.com/a?b=1 ')).toBe('http://example.com/a?b=1');
    expect(safeHyperlink('mailto:team@example.com')).toBe('mailto:team@example.com');
  });

  it('drops every other scheme, a relative or broken address, and a non-string', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<b>x</b>',
      'file:///etc/passwd',
      'ftp://example.com',
      '/relative/path',
      'liveplanner.app',
      '',
      'https://' + 'a'.repeat(HYPERLINK_URL_MAX),
    ])
      expect(safeHyperlink(bad), bad).toBeNull();
    expect(safeHyperlink(42)).toBeNull();
    expect(safeHyperlink(null)).toBeNull();
  });
});

describe('Workbook.hyperlinkOf', () => {
  const at = (b: ReturnType<typeof book>, a1: string) => {
    const sheet = b.sheets[0]!;
    const r = Number(a1.slice(1)) - 1;
    const c = a1.charCodeAt(0) - 65;
    return b.wb.hyperlinkOf(sheet.id, r, c);
  };

  it('reads the target of a HYPERLINK formula, while the value stays the label', () => {
    const b = book({ A1: '=HYPERLINK("https://liveplanner.app", "liveplanner")' });
    expect(b.v('A1')).toBe('liveplanner');
    expect(at(b, 'A1')).toBe('https://liveplanner.app/');
  });

  it('works the target out in the cell, references included, and follows a change', () => {
    const b = book({ A1: 'https://example.com/a', B1: '=HYPERLINK(A1&"?x=1", "Open")' });
    expect(at(b, 'B1')).toBe('https://example.com/a?x=1');
    b.set('A1', 'https://example.com/b');
    expect(at(b, 'B1')).toBe('https://example.com/b?x=1');
  });

  it('is null for a disallowed target, a nested HYPERLINK, a plain value and an empty cell', () => {
    const b = book({
      A1: '=HYPERLINK("javascript:alert(1)", "x")',
      A2: '=UPPER(HYPERLINK("https://example.com", "x"))',
      A3: 'https://example.com',
      A4: '=1+1',
    });
    expect(at(b, 'A1')).toBeNull();
    expect(b.v('A1')).toBe('x');
    expect(at(b, 'A2')).toBeNull();
    expect(at(b, 'A3')).toBeNull();
    expect(at(b, 'A4')).toBeNull();
    expect(at(b, 'A5')).toBeNull();
  });
});

describe('the render model', () => {
  it('carries a HYPERLINK cell as a link, underlined, and no other', () => {
    const b = book({ A1: '=HYPERLINK("https://liveplanner.app", "liveplanner")', A2: 'plain' });
    const model = renderWindow(b.wb, b.sheets[0]!.id, { width: 600, height: 200 }, 'en-GB')!;
    const cell = (text: string) => model.cells.find((x) => x.text === text)!;
    expect(cell('liveplanner')).toMatchObject({
      link: 'https://liveplanner.app/',
      underline: true,
    });
    expect(cell('plain').link).toBeUndefined();
  });
});
