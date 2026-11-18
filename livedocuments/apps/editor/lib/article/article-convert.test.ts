// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from '@livedocuments/document';
import { DOMParser as PMDOMParser, DOMSerializer } from 'prosemirror-model';
import { blocksToDoc, docToBlocks } from './article-convert';
import { articleSchema } from './article-schema';

// docs/specs/007-editor/article-pages.md "Blocks": every block survives the round trip.
const blocks: ArticleBlock[] = [
  { id: 't', type: 'paragraph', style: 'title', runs: [{ text: 'Hello' }] },
  {
    id: 'p',
    type: 'paragraph',
    align: 'center',
    runs: [
      { text: 'plain ' },
      { text: 'bold\nnext', b: true },
      { text: ' link', href: 'https://livedocuments.app', u: true },
      { text: ' red', color: '#dc2626', hl: '#fef08a' },
      { text: 'x', sup: true },
    ],
  },
  { id: 'l1', type: 'list', list: 'todo', checked: true, runs: [{ text: 'done' }] },
  { id: 'l2', type: 'list', list: 'numbered', level: 2, runs: [] },
  { id: 'c', type: 'code', text: 'const a = 1;\n  b();' },
  { id: 'c2', type: 'code', text: 'let a;', lang: 'ts' },
  { id: 'd', type: 'divider' },
  { id: 'pb', type: 'pageBreak' },
  {
    id: 'z',
    type: 'zone',
    zone: 'object',
    wrap: 'left',
    align: 'right',
    width: 200,
    height: 120,
    at: { page: 'p1', x: 96, y: 300 },
  },
  { id: 'e', type: 'paragraph', runs: [] },
];

describe('the writing in the editor and back', () => {
  it('round-trips every block type and format', () => {
    expect(docToBlocks(blocksToDoc(blocks))).toEqual(blocks);
  });

  it('keeps each unchanged block, and the list itself, by identity', () => {
    const doc = blocksToDoc(blocks);
    expect(docToBlocks(doc, blocks)).toBe(blocks);
    const edited = doc.replace(
      1,
      1,
      blocksToDoc([{ id: 'x', type: 'paragraph', runs: [] }]).slice(1, 1),
    );
    const out = docToBlocks(edited, blocks);
    expect(out[2]).toBe(blocks[2]);
  });

  it("keeps a code block's language through a copy and paste of its HTML", () => {
    const code: ArticleBlock[] = [
      { id: 'c', type: 'code', text: 'let a;', lang: 'ts' },
      { id: 'd', type: 'code', text: 'plain' },
    ];
    const div = document.createElement('div');
    div.append(
      DOMSerializer.fromSchema(articleSchema).serializeFragment(blocksToDoc(code).content),
    );
    expect(div.querySelector('pre')?.getAttribute('data-lang')).toBe('ts');
    expect(div.querySelectorAll('pre')[1]?.hasAttribute('data-lang')).toBe(false);
    // A paste gives its blocks fresh ids; the language comes with it.
    const pasted = PMDOMParser.fromSchema(articleSchema).parse(div);
    expect(pasted.content.content.map((n) => n.attrs.lang)).toEqual(['ts', '']);
  });
});
