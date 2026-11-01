// @vitest-environment jsdom
// Pasted HTML into the writing (docs/specs/007-editor/article-pages.md "Writing", Paste): headings,
// lists and quotes from a web page, Google Docs or Word are kept, as the blocks they are.
import { describe, expect, it } from 'vitest';
import { DOMParser as PMDOMParser, type Node as PMNode, type Slice } from 'prosemirror-model';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { normalisePastedTables } from './article-table-paste';
import { articleSchema } from './article-schema';
import { articlePasteProps } from './article-paste';

const parse = (html: string): Slice => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return PMDOMParser.fromSchema(articleSchema).parseSlice(div);
};

const blocks = (slice: Slice) => {
  const out: string[] = [];
  slice.content.forEach((n: PMNode) => {
    const a = n.attrs as Record<string, unknown>;
    const kind =
      n.type.name === 'list_item'
        ? `${String(a.list)}${String(a.level)}${a.checked ? 'x' : ''}`
        : n.type.name === 'paragraph'
          ? String(a.style)
          : n.type.name;
    out.push(`${kind}:${n.textContent}`);
  });
  return out;
};

describe('pasted HTML', () => {
  it('reads a list item holding a paragraph as the item (Google Docs, web pages)', () => {
    expect(
      blocks(
        parse(
          '<b style="font-weight:normal" id="docs-internal-guid-1"><ul><li aria-level="1"><p role="presentation"><span>One</span></p></li><ul><li aria-level="2"><p role="presentation"><span>Nested</span></p></li></ul></ul><ol><li><p>First</p></li></ol></b>',
        ),
      ),
    ).toEqual(['bullet0:One', 'bullet1:Nested', 'numbered0:First']);
  });

  it("reads Google Docs' checklist items as to-dos", () => {
    expect(
      blocks(
        parse(
          '<ul><li role="checkbox" aria-checked="true"><p>Done</p></li><li role="checkbox" aria-checked="false"><p>Open</p></li></ul>',
        ),
      ),
    ).toEqual(['todo0x:Done', 'todo0:Open']);
  });

  it("reads a quote's paragraphs as quotes, with no empty quote before them", () => {
    expect(
      blocks(parse('<blockquote><p>One</p><p>Two</p></blockquote><blockquote>Bare</blockquote>')),
    ).toEqual(['quote:One', 'quote:Two', 'quote:Bare']);
  });

  it("reads Word's list paragraphs as list items, their typed markers dropped", () => {
    const word = [
      `<p class=MsoListParagraphCxSpFirst style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>Bullet<o:p></o:p></p>`,
      `<p class=MsoListParagraphCxSpLast style='margin-left:72.0pt;text-indent:-18.0pt;mso-list:l0 level2 lfo1'><![if !supportLists]><span style='font-family:"Courier New"'><span style='mso-list:Ignore'>o<span>&nbsp;&nbsp; </span></span></span><![endif]>Nested<o:p></o:p></p>`,
      `<p class=MsoListParagraph style='text-indent:-18.0pt;mso-list:l1 level1 lfo2'><![if !supportLists]><span><span style='mso-list:Ignore'>1.<span>&nbsp;&nbsp; </span></span></span><![endif]>Number<o:p></o:p></p>`,
      `<p class=MsoListParagraph style='mso-list:l1 level2 lfo2'><span style='mso-list:Ignore'>b)<span>&nbsp;</span></span>Letter</p>`,
      `<p class=MsoQuote>Quoted</p>`,
    ].join('');
    expect(blocks(parse(word))).toEqual([
      'bullet0:Bullet',
      'bullet1:Nested',
      'numbered0:Number',
      'numbered1:Letter',
      'quote:Quoted',
    ]);
  });

  // A pasted table is a table block (docs/specs/007-editor/article-pages.md "Tables", Paste), its cells
  // kept apart; article-table-paste.ts makes each cell's blocks lines first.
  it('keeps table cells of text apart, a table block of them', () => {
    const slice = parse(
      normalisePastedTables(
        '<table><tr><th>Head</th><td>Cell</td></tr><tr><td><p>In a p</p></td></tr></table>',
      ),
    );
    const table = slice.content.firstChild!;
    expect(slice.content.childCount).toBe(1);
    expect(table.type.name).toBe('table');
    const cells: string[] = [];
    table.descendants((n) => {
      if (n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell')
        cells.push(n.textContent);
      return true;
    });
    expect(cells).toEqual(['Head', 'Cell', 'In a p', '']);
  });
});

describe('pasted HTML into an empty block', () => {
  const doc = articleSchema.node('doc', null, [
    articleSchema.node('paragraph', { style: 'title' }, [articleSchema.text('Title')]),
    articleSchema.node('paragraph', { style: 'body' }),
  ]);
  const paste = (html: string, at: number, start = doc) => {
    let state = EditorState.create({ doc: start });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, at)));
    const view = {
      get state() {
        return state;
      },
      dispatch: (tr: Transaction) => {
        state = state.apply(tr);
      },
    } as unknown as EditorView;
    const dt = { types: ['text/html', 'text/plain'], getData: () => '' };
    const handled = articlePasteProps.handlePaste!(
      view,
      { clipboardData: dt } as unknown as ClipboardEvent,
      parse(html),
    );
    const out: string[] = [];
    state.doc.forEach((n) => out.push(`${String(n.attrs.style ?? n.attrs.list)}:${n.textContent}`));
    return { handled, out };
  };

  it('takes a pasted heading whole, so it stays a heading', () => {
    expect(paste('<h1>Heading</h1><p>Body</p>', 8)).toEqual({
      handled: true,
      out: ['title:Title', 'h1:Heading', 'body:Body'],
    });
  });

  it('takes a pasted list whole', () => {
    expect(paste('<ul><li>One</li><li>Two</li></ul>', 8).out).toEqual([
      'title:Title',
      'bullet:One',
      'bullet:Two',
    ]);
  });

  it("leaves a plain paragraph to ProseMirror, which keeps the block's own style", () => {
    expect(paste('<p>Words</p>', 8).handled).toBe(false);
  });

  it('leaves the empty title to ProseMirror, so a pasted heading is the title', () => {
    const emptyTitle = articleSchema.node('doc', null, [
      articleSchema.node('paragraph', { style: 'title' }),
    ]);
    expect(paste('<h1>Heading</h1><p>Body</p>', 1, emptyTitle).handled).toBe(false);
  });

  it('leaves a block with text in it to ProseMirror', () => {
    expect(paste('<h1>Heading</h1>', 3).handled).toBe(false);
  });
});
