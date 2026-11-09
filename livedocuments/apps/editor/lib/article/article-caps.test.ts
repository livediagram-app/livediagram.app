import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { Slice, Fragment } from 'prosemirror-model';
import {
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_BLOCKS,
  MAX_ARTICLE_CELL_TEXT,
  newArticleTable,
  type ArticleBlock,
} from '@livedocuments/document';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { blocksToDoc } from './article-convert';
import { articleSchema as S } from './article-schema';
import {
  ARTICLE_CAP_NOTICE,
  announceArticleCap,
  articleCapsPlugin,
  capPassed,
  setArticleCapsToast,
  textblockSize,
} from './article-caps';

// docs/specs/007-editor/article-pages.md "Blocks", How much an article holds: writing never goes past the
// caps and is never cut afterwards.

const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: text ? [{ text }] : [],
});

const stateOf = (blocks: ArticleBlock[], onRefused = vi.fn()) =>
  EditorState.create({ doc: blocksToDoc(blocks), plugins: [articleCapsPlugin(onRefused)] });

const at = (s: EditorState, pos: number) =>
  s.apply(s.tr.setSelection(TextSelection.create(s.doc, pos)));

describe('textblockSize', () => {
  it('counts text, link addresses, line breaks and footnotes as the stored form does', () => {
    const link = S.marks.link.create({ href: 'https://a.example' });
    const p = S.nodes.paragraph.create({ id: 'p' }, [
      S.text('abc', [link]),
      S.nodes.hard_break.create(),
      S.text('de'),
      S.nodes.footnote.create({ text: 'note' }),
    ]);
    // 3 + 17 (href), the break 1 + 17 (the link before it), 2, then the reference 1 + 4.
    expect(textblockSize(p)).toBe(3 + 17 + 1 + 17 + 2 + 1 + 4);
    expect(textblockSize(S.nodes.code_block.create({ id: 'c' }, S.text('x\ny')))).toBe(3);
  });
});

describe('capPassed / articleCapsPlugin', () => {
  it('refuses typing past a paragraph cap and lets it up to the cap', () => {
    const onRefused = vi.fn();
    const full = 'a'.repeat(MAX_ARTICLE_BLOCK_TEXT - 1);
    let s = at(stateOf([para('p', full)], onRefused), 1);
    s = s.apply(s.tr.insertText('b'));
    expect(textblockSize(s.doc.child(0))).toBe(MAX_ARTICLE_BLOCK_TEXT);
    const refused = s.apply(s.tr.insertText('c'));
    expect(refused.doc).toBe(s.doc);
    expect(onRefused).toHaveBeenCalledWith('text', expect.anything());
  });

  it('refuses a paste that would make a paragraph too long, whole', () => {
    const onRefused = vi.fn();
    const s = at(stateOf([para('p', 'hello')], onRefused), 3);
    const big = new Slice(Fragment.from(S.text('x'.repeat(MAX_ARTICLE_BLOCK_TEXT))), 0, 0);
    const next = s.apply(s.tr.replaceSelection(big).setMeta('uiEvent', 'paste'));
    expect(next.doc.textContent).toBe('hello');
    expect(onRefused).toHaveBeenCalledWith('text', expect.anything());
  });

  it('lets a block already past the cap be shortened, but not lengthened', () => {
    const over = 'a'.repeat(MAX_ARTICLE_BLOCK_TEXT + 10);
    const s = stateOf([para('p', over)]);
    expect(capPassed(s.tr.delete(1, 3))).toBeNull();
    expect(capPassed(s.tr.insertText('z', 1))).toBe('text');
    // Split in two by Enter: each half is in reach again.
    expect(capPassed(s.tr.split(1 + MAX_ARTICLE_BLOCK_TEXT / 2))).toBeNull();
  });

  it('refuses joining two blocks into one past the cap', () => {
    const half = 'a'.repeat(MAX_ARTICLE_BLOCK_TEXT / 2 + 1);
    const s = stateOf([para('p', half), para('q', half)]);
    const end = s.doc.child(0).nodeSize;
    expect(capPassed(s.tr.join(end))).toBe('text');
  });

  it('refuses a block past the article cap, and allows edits at the cap that add none', () => {
    const blocks = Array.from({ length: MAX_ARTICLE_BLOCKS }, (_, i) => para(`b${i}`, 'x'));
    const s = at(stateOf(blocks), 2);
    expect(capPassed(s.tr.split(2))).toBe('blocks');
    expect(capPassed(s.tr.insertText('y'))).toBeNull();
    expect(capPassed(s.tr.delete(0, s.doc.child(0).nodeSize))).toBeNull();
  });

  it("refuses a table cell's text past the cell cap", () => {
    const t = newArticleTable('t', 1, 1, false);
    const s = stateOf([{ ...t, rows: [{ ...t.rows[0]!, cells: [[{ text: 'a' }]] }] }]);
    let inCell = -1;
    s.doc.descendants((n, pos) => {
      if (inCell < 0 && n.type.name === 'table_cell') inCell = pos + 1;
    });
    expect(capPassed(s.tr.insertText('b'.repeat(MAX_ARTICLE_CELL_TEXT - 1), inCell))).toBeNull();
    expect(capPassed(s.tr.insertText('b'.repeat(MAX_ARTICLE_CELL_TEXT), inCell))).toBe('cell');
  });

  it("never refuses a peer's writing or the stored form's replacing", () => {
    const onRefused = vi.fn();
    const s = at(stateOf([para('p', 'a'.repeat(MAX_ARTICLE_BLOCK_TEXT))], onRefused), 1);
    const next = s.apply(s.tr.insertText('b').setMeta('article-remote', true));
    expect(next.doc.textContent.length).toBe(MAX_ARTICLE_BLOCK_TEXT + 1);
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('checks a keystroke in a long article within budget', () => {
    const blocks = Array.from({ length: MAX_ARTICLE_BLOCKS }, (_, i) =>
      para(`b${i}`, 'x'.repeat(400)),
    );
    const s = at(stateOf(blocks), 3);
    const tr = s.tr.insertText('y');
    // 100 checks well under 50 ms of CPU: each reads the one block touched, never the whole article.
    expect(
      cpuMsOf(() => {
        for (let i = 0; i < 100; i++) capPassed(tr);
      }),
    ).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('announceArticleCap', () => {
  afterEach(() => setArticleCapsToast(null));

  it('says which cap, at most once in a few seconds', () => {
    const toast = vi.fn();
    setArticleCapsToast(toast);
    announceArticleCap('blocks', 1_000_000);
    announceArticleCap('text', 1_000_100);
    announceArticleCap('cell', 1_010_000);
    expect(toast.mock.calls).toEqual([[ARTICLE_CAP_NOTICE.blocks], [ARTICLE_CAP_NOTICE.cell]]);
    expect(ARTICLE_CAP_NOTICE.text).toBe('A paragraph holds at most 20,000 characters.');
  });
});
