import { describe, expect, it } from 'vitest';
import {
  docListMarkers,
  docsOf,
  docWordCount,
  MAX_DOC_BLOCK_TEXT,
  newDocFlow,
  normaliseRuns,
  parseDocBlock,
  parseDocFlow,
  parseDocStyle,
  withFreshDocBlockIds,
} from './doc-flow';
import { applyDocOps, diffDocFlow } from './doc-flow-ops';
import type { DocBlock, DocFlow } from './doc-flow';

const P = (id: string, text = id): DocBlock => ({
  id,
  type: 'paragraph',
  runs: text ? [{ text }] : [],
});

describe('document writing: reading it', () => {
  it('keeps valid runs, merges same-format neighbours, drops the rest', () => {
    expect(
      normaliseRuns([
        { text: 'a', b: true },
        { text: 'b', b: true },
        { text: '' },
        { text: 'c', href: 'javascript:alert(1)', color: 'red' },
        { text: 'd', href: 'https://x.dev', hl: '#ff0', sup: true, sub: true },
        'nope',
      ]),
    ).toEqual([
      { text: 'ab', b: true },
      { text: 'c' },
      { text: 'd', href: 'https://x.dev', hl: '#ff0', sup: true },
    ]);
  });

  it('caps the text of a block', () => {
    const runs = normaliseRuns([{ text: 'x'.repeat(MAX_DOC_BLOCK_TEXT + 50) }]);
    expect(runs[0]!.text).toHaveLength(MAX_DOC_BLOCK_TEXT);
  });

  it('reads each block type and drops defaults', () => {
    expect(
      parseDocBlock({ id: 'a', type: 'paragraph', style: 'body', align: 'left', runs: [] }),
    ).toEqual({ id: 'a', type: 'paragraph', runs: [] });
    expect(
      parseDocBlock({ id: 'a', type: 'list', list: 'todo', level: 9, checked: true, runs: [] }),
    ).toEqual({
      id: 'a',
      type: 'list',
      list: 'todo',
      level: 4,
      checked: true,
      runs: [],
    });
    expect(
      parseDocBlock({ id: 'a', type: 'list', list: 'bullet', checked: true, runs: [] }),
    ).toEqual({
      id: 'a',
      type: 'list',
      list: 'bullet',
      runs: [],
    });
    expect(
      parseDocBlock({
        id: 'a',
        type: 'zone',
        zone: 'drawing',
        width: 5,
        height: 99999,
        at: { x: 1, y: 'no' },
      }),
    ).toEqual({
      id: 'a',
      type: 'zone',
      zone: 'drawing',
      width: 24,
      height: 2000,
    });
    expect(
      parseDocBlock({ id: 'a', type: 'zone', zone: 'other', width: 50, height: 50 }),
    ).toBeUndefined();
    expect(parseDocBlock({ id: '', type: 'divider' })).toBeUndefined();
    expect(parseDocBlock({ id: 'a', type: 'video' })).toBeUndefined();
  });

  it('reads a flow: repeats and junk dropped, never empty', () => {
    const flow = parseDocFlow({
      blocks: [P('a'), P('a'), { id: 'z' }, { id: 'c', type: 'divider' }],
    });
    expect(flow.blocks.map((b) => b.id)).toEqual(['a', 'c']);
    expect(parseDocFlow({ blocks: [] }, 'x').blocks).toEqual([
      { id: 'x', type: 'paragraph', runs: [] },
    ]);
    expect(parseDocFlow(null).blocks).toHaveLength(1);
  });

  it('reads a style field by field', () => {
    expect(
      parseDocStyle({
        look: 'notebook',
        accent: '#123456',
        margins: 'tiny',
        rules: 'headings',
        bodyFont: 'Lora!',
      }),
    ).toEqual({ look: 'notebook', accent: '#123456', rules: 'headings' });
    expect(parseDocStyle({ nothing: 1 })).toBeUndefined();
  });

  it('reads the tab docs once per stored object', () => {
    const docs = { d1: { blocks: [P('a')] }, '': { blocks: [] } };
    const a = docsOf({ docs });
    expect(Object.keys(a)).toEqual(['d1']);
    expect(docsOf({ docs })).toBe(a);
    expect(docsOf({})).toEqual({});
  });

  it('counts words', () => {
    expect(
      docWordCount([P('a', 'two words'), { id: 'c', type: 'code', text: 'x = 1' }, P('e', '')]),
    ).toBe(5);
  });

  it('starts a document with a title and a paragraph', () => {
    const f = newDocFlow();
    expect(f.blocks.map((b) => (b.type === 'paragraph' ? (b.style ?? 'body') : b.type))).toEqual([
      'title',
      'body',
    ]);
    const copy = withFreshDocBlockIds(f);
    expect(copy.blocks.map((b) => b.id)).not.toContain(f.blocks[0]!.id);
  });
});

describe('document writing: block ops', () => {
  const flow = (...blocks: DocBlock[]): DocFlow => ({ blocks });
  const round = (a: DocFlow, b: DocFlow) => applyDocOps(a, diffDocFlow(a, b));

  it('sends nothing when nothing changed', () => {
    const a = flow(P('a'), P('b'));
    expect(diffDocFlow(a, { blocks: [...a.blocks] })).toEqual([]);
  });

  it('round-trips inserts, edits, removals and moves', () => {
    const a = flow(P('a'), P('b'), P('c'), P('d'));
    const cases: DocFlow[] = [
      flow(P('a'), P('x'), P('b'), P('c'), P('d')),
      flow(P('a'), P('b', 'B!'), P('c'), P('d')),
      flow(P('a'), P('d')),
      flow(P('d'), P('a'), P('b'), P('c')),
      flow(P('c'), P('n'), P('a')),
      { blocks: a.blocks, style: { look: 'bold' } },
    ];
    for (const b of cases) expect(round(a, b)).toEqual(b);
  });

  it('does not resend a block whose neighbour changed', () => {
    const a = flow(P('a'), P('b'));
    const ops = diffDocFlow(a, flow(P('a'), P('x'), P('b')));
    expect(ops).toEqual([{ kind: 'put', block: P('x'), after: 'a', before: 'b' }]);
  });

  it('merges two people writing different blocks', () => {
    const base = flow(P('a'), P('b'), P('c'));
    const mine = diffDocFlow(base, flow(P('a', 'A1'), P('b'), P('c')));
    const theirs = diffDocFlow(base, flow(P('a'), P('b'), P('n'), P('c', 'C2')));
    const merged = flow(P('a', 'A1'), P('b'), P('n'), P('c', 'C2'));
    expect(applyDocOps(applyDocOps(base, mine), theirs)).toEqual(merged);
    expect(applyDocOps(applyDocOps(base, theirs), mine)).toEqual(merged);
  });

  it('places a block whose neighbour went by its other neighbour', () => {
    const base = flow(P('a'), P('b'), P('c'));
    const insert = diffDocFlow(base, flow(P('a'), P('b'), P('x'), P('c')));
    const removeB = diffDocFlow(base, flow(P('a'), P('c')));
    expect(applyDocOps(applyDocOps(base, removeB), insert).blocks.map((b) => b.id)).toEqual([
      'a',
      'x',
      'c',
    ]);
  });

  it('builds a document that arrives whole, and never leaves one empty', () => {
    const b = flow(P('a'), P('b'));
    expect(applyDocOps(undefined, diffDocFlow(undefined, b))).toEqual(b);
    expect(
      applyDocOps(b, [
        { kind: 'remove', id: 'a' },
        { kind: 'remove', id: 'b' },
      ]).blocks,
    ).toHaveLength(1);
  });
});

describe('list markers', () => {
  const L = (id: string, list: 'bullet' | 'numbered' | 'todo', level = 0) => ({
    id,
    type: 'list',
    list,
    level,
  });
  it('count numbered items by level, restarting after a bullet or another block', () => {
    const m = docListMarkers([
      L('a', 'numbered'),
      L('b', 'numbered', 1),
      L('c', 'numbered', 1),
      L('d', 'numbered', 2),
      L('e', 'numbered'),
      L('f', 'bullet', 1),
      L('g', 'numbered', 1),
      { id: 'p', type: 'paragraph' },
      L('h', 'numbered'),
      L('t', 'todo'),
    ]);
    expect([...m.values()]).toEqual(['1.', 'a.', 'b.', 'i.', '2.', '◦', 'a.', '1.', '']);
  });
});
