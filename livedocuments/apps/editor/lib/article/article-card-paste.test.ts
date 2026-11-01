// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DOMParser as PMDOMParser, type Slice } from 'prosemirror-model';
import { articleSchema } from './article-schema';
import { normalisePastedTables } from './article-table-paste';
import { cardPasteSlice } from './article-card-paste';

// docs/specs/007-editor/flashcards.md "Text only": a paste onto a card keeps the text, a table as a list.
// Parsed as the editor parses a paste: nodes with no ids yet, a table's slice open into its first cell.
const pasted = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = normalisePastedTables(html);
  return PMDOMParser.fromSchema(articleSchema).parseSlice(div);
};
const kinds = (s: Slice) => {
  const out: string[] = [];
  s.content.forEach((n) => out.push(`${n.type.name}:${n.textContent}`));
  return out;
};

describe('cardPasteSlice', () => {
  it('makes a pasted table a list, a row an item, the header bold, closed at both ends', () => {
    const { slice, cut } = cardPasteSlice(
      pasted(
        '<table><tr><th>Name</th><th>Role</th></tr><tr><td>Ada</td><td><em>Lead</em></td></tr></table>',
      ),
    );
    expect(cut).toBe(true);
    expect(kinds(slice)).toEqual(['list_item:Name · Role', 'list_item:Ada · Lead']);
    expect([slice.openStart, slice.openEnd]).toEqual([0, 0]);
    const head = slice.content.firstChild!.firstChild!;
    expect(head.marks.map((m) => m.type.name)).toContain('bold');
    const lead = slice.content.lastChild!.lastChild!;
    expect(lead.marks.map((m) => m.type.name)).toContain('italic');
  });

  it('keeps the text around a table, and leaves a divider and a heading as they are', () => {
    const { slice } = cardPasteSlice(
      pasted('<h2>Heading</h2><table><tr><td>a</td><td>b</td></tr></table><p>after</p>'),
    );
    expect(kinds(slice)).toEqual(['paragraph:Heading', 'list_item:a · b', 'paragraph:after']);
  });

  it('hands back text alone untouched', () => {
    const s = pasted('<p>one</p><ul><li>two</li></ul>');
    expect(cardPasteSlice(s)).toEqual({ slice: s, cut: false });
  });
});
