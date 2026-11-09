import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livedocuments/document';
import { rebaseLocalEdits } from './rebase-local-edits';

// docs/specs/012-collaboration/resync-without-reload.md "Fault 2": a resync keeps what was not saved yet.
const el = (id: string, x = 0): Element => ({
  id,
  type: 'text',
  x,
  y: 0,
  width: 10,
  height: 10,
  label: id,
});
const tab = (els: Element[], extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements: els,
  ...extra,
});

describe('rebaseLocalEdits', () => {
  it("puts this editor's unsaved edits on top of the server's copy, keeping the peer's", () => {
    const baseline = tab([el('mine'), el('gone'), el('theirs')]);
    // Offline here: moved one, deleted one, added one.
    const screen = tab([el('mine', 50), el('theirs'), el('new')]);
    // Meanwhile a peer moved theirs and added another.
    const fetched = tab([el('mine'), el('gone'), el('theirs', 9), el('peer')]);
    const out = rebaseLocalEdits(fetched, screen, baseline);
    expect(out.elements.map((e) => [e.id, (e as { x: number }).x])).toEqual([
      ['mine', 50],
      ['theirs', 9],
      ['peer', 0],
      ['new', 0],
    ]);
  });

  it('counts a peer op that made new but equal objects as no edit, and keeps tab fields changed here', () => {
    const baseline = tab([el('a')], { theme: 'ocean' });
    const screen = tab([{ ...el('a') }], { theme: 'forest' });
    const fetched = tab([el('a', 7)], { theme: 'ocean' });
    const out = rebaseLocalEdits(fetched, screen, baseline);
    expect((out.elements[0] as { x: number }).x).toBe(7);
    expect(out.theme).toBe('forest');
  });

  it('keeps a tab field cleared here cleared, rather than taking the server’s back', () => {
    // A look reset deletes the tab's font; the server still has it, unsaved.
    const baseline = tab([el('a')], { font: 'serif' });
    const screen = tab([el('a')]);
    const fetched = tab([el('a', 4)], { font: 'serif' });
    const out = rebaseLocalEdits(fetched, screen, baseline);
    expect('font' in out).toBe(false);
    expect((out.elements[0] as { x: number }).x).toBe(4);
  });

  it('is the fetched copy when nothing here is unsaved', () => {
    const baseline = tab([el('a')]);
    const fetched = tab([el('a', 3)]);
    expect(rebaseLocalEdits(fetched, tab([el('a')]), baseline)).toBe(fetched);
  });

  it("rebases this editor's writing block by block, keeping a peer's blocks in the same article", () => {
    const para = (id: string, text: string) => ({
      id,
      type: 'paragraph' as const,
      runs: [{ text }],
    });
    const flow = (...blocks: ReturnType<typeof para>[]) => ({ blocks });
    const baseline = tab([el('a')], {
      articles: { f: flow(para('p1', 'one'), para('p2', 'two')) },
    });
    // Typed here, unsaved, in p1.
    const screen = tab([el('a')], { articles: { f: flow(para('p1', 'one!'), para('p2', 'two')) } });
    // Meanwhile a peer wrote p2 and added p3, and started another article.
    const fetched = tab([el('a')], {
      articles: {
        f: flow(para('p1', 'one'), para('p2', 'TWO'), para('p3', 'three')),
        g: flow(para('q1', 'other')),
      },
    });
    const out = rebaseLocalEdits(fetched, screen, baseline);
    expect(
      out.articles?.f?.blocks.map((b) => [b.id, (b as ReturnType<typeof para>).runs[0]!.text]),
    ).toEqual([
      ['p1', 'one!'],
      ['p2', 'TWO'],
      ['p3', 'three'],
    ]);
    expect(Object.keys(out.articles ?? {})).toEqual(['f', 'g']);
  });

  it('removes only the article removed here, and drops the field when none is left', () => {
    const f = { blocks: [{ id: 'p1', type: 'paragraph' as const, runs: [{ text: 'x' }] }] };
    const baseline = tab([el('a')], { articles: { f } });
    const screen = tab([el('a')]);
    expect(
      'articles' in rebaseLocalEdits(tab([el('a')], { articles: { f } }), screen, baseline),
    ).toBe(false);
    const out = rebaseLocalEdits(tab([el('a')], { articles: { f, g: f } }), screen, baseline);
    expect(Object.keys(out.articles ?? {})).toEqual(['g']);
  });
});
