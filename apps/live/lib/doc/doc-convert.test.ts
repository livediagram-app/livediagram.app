import { describe, expect, it } from 'vitest';
import type { DocBlock } from '@livediagram/document';
import { blocksToDoc, docToBlocks } from './doc-convert';

// docs/specs/007-editor/document-pages.md "Blocks": every block survives the round trip.
const blocks: DocBlock[] = [
  { id: 't', type: 'paragraph', style: 'title', runs: [{ text: 'Hello' }] },
  {
    id: 'p',
    type: 'paragraph',
    align: 'center',
    runs: [
      { text: 'plain ' },
      { text: 'bold\nnext', b: true },
      { text: ' link', href: 'https://livediagram.app', u: true },
      { text: ' red', color: '#dc2626', hl: '#fef08a' },
      { text: 'x', sup: true },
    ],
  },
  { id: 'l1', type: 'list', list: 'todo', checked: true, runs: [{ text: 'done' }] },
  { id: 'l2', type: 'list', list: 'numbered', level: 2, runs: [] },
  { id: 'c', type: 'code', text: 'const a = 1;\n  b();' },
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
});
