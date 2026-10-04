import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape } from './factories';
import { mindChildren } from './mind-map';
import { relayoutMindMap, applyMindMoves } from './mind-grow';
import { mindOutlineText, parseMindOutline, type MindOutlineNode } from './mind-outline-text';
import { applyMindOutline, summariseMindOutline, type MindOutlineDress } from './mind-outline';
import type { ArrowElement, Element, ShapeElement } from './index';

// docs/specs/009-elements/mind-node.md "Edit Outline".

const node = (id: string, label: string, parent?: string, extra: Partial<ShapeElement> = {}) =>
  ({
    ...(createShape('mind-node', 0, 0) as ShapeElement),
    id,
    label,
    width: 200,
    height: 60,
    ...(parent ? { mindParentId: parent } : {}),
    ...extra,
  }) as ShapeElement;
const link = (from: string, to: string): ArrowElement => ({
  ...createPinnedArrow(from, 'e', to, 'w'),
  id: `${from}->${to}`,
});

// Team offsite: Venue (Lake District), Agenda (Day 1), Travel; laid out as a tree.
function offsite(): Element[] {
  const els: Element[] = [
    node('root', 'Team offsite', undefined, { mindFlow: 'tree' }),
    node('venue', 'Venue', 'root', { fillColor: '#fee2e2' }),
    node('lake', 'Lake District', 'venue'),
    node('agenda', 'Agenda', 'root'),
    node('day1', 'Day 1', 'agenda'),
    node('travel', 'Travel', 'root'),
    link('root', 'venue'),
    link('venue', 'lake'),
    link('root', 'agenda'),
    link('agenda', 'day1'),
    link('root', 'travel'),
  ];
  // Stacked in document order, then laid out: the order a tree reads, top to bottom.
  const order = new Map(els.map((e, i) => [e.id, i]));
  const r = relayoutMindMap(els, 'root', undefined, order)!;
  return applyMindMoves(els, r.moves, r.reanchored);
}

let seq = 0;
const dress: MindOutlineDress = {
  newId: () => `new${++seq}`,
  node: (n, from) => (from ? { ...n, fillColor: from.fillColor } : n),
  connector: (a, from) => (from?.strokeColor ? { ...a, strokeColor: from.strokeColor } : a),
};
const parse = (text: string) => parseMindOutline(text)!;
const shape = (els: Element[], id: string) => els.find((e) => e.id === id) as ShapeElement;
const byLabel = (els: Element[], label: string) =>
  els.find((e): e is ShapeElement => e.type === 'shape' && e.label === label)!;
const kids = (els: Element[], id: string) => mindChildren(els, id).map((n) => n.label);
const outlineOf = (els: Element[]) => mindOutlineText(els, 'root', 'tree');

describe('mindOutlineText', () => {
  it('writes the root, then each node two spaces deeper than its parent, in drawn order', () => {
    expect(outlineOf(offsite())).toBe(
      ['Team offsite', '- Venue', '  - Lake District', '- Agenda', '  - Day 1', '- Travel'].join(
        '\n',
      ),
    );
  });

  it('joins a node with several lines of text onto one line', () => {
    const els = offsite().map((e) => (e.id === 'travel' ? { ...e, label: 'Travel\nby train' } : e));
    expect(outlineOf(els)).toContain('- Travel by train');
  });
});

describe('parseMindOutline', () => {
  const tree = (n: MindOutlineNode | null): unknown =>
    n ? [n.text, ...n.children.map((c) => tree(c))] : null;

  it('reads bullets nested by indentation under a first-line root', () => {
    expect(tree(parse('Root\n- A\n  - A1\n- B'))).toEqual(['Root', ['A', ['A1']], ['B']]);
  });

  it('reads numbered items, other bullet marks, tabs and unmarked lines', () => {
    expect(tree(parse('Root\n1. A\n\t* A1\n2) B\n  plain'))).toEqual([
      'Root',
      ['A', ['A1']],
      ['B', ['plain']],
    ]);
  });

  it('nests headings by their # count, and bullets one level below their heading', () => {
    expect(tree(parse('# Root\n## A\n- a1\n  - a2\n## B\n### B1'))).toEqual([
      'Root',
      ['A', ['a1', ['a2']]],
      ['B', ['B1']],
    ]);
  });

  it('never skips a level, and reads a second root-level line as a child of the root', () => {
    expect(tree(parse('Root\n      - deep\nOther'))).toEqual(['Root', ['deep'], ['Other']]);
  });

  it('skips blank lines and strips inline Markdown', () => {
    expect(tree(parse('\n**Root**\n\n- [x] _Done_ `now`\n- [see](http://x.y)'))).toEqual([
      'Root',
      ['Done now'],
      ['see'],
    ]);
  });

  it('is null with no lines', () => {
    expect(parseMindOutline('  \n\n')).toBeNull();
  });
});

describe('applyMindOutline', () => {
  it('changes nothing when the outline matches the map', () => {
    const els = offsite();
    expect(applyMindOutline(els, 'root', parse(outlineOf(els)), dress)).toBeNull();
  });

  it('keeps a node whose line stays, with its look', () => {
    const els = offsite();
    const out = applyMindOutline(
      els,
      'root',
      parse('Team offsite\n- Travel\n- Venue\n  - Lake District\n- Agenda\n  - Day 1'),
      dress,
    )!;
    expect(shape(out, 'venue').fillColor).toBe('#fee2e2');
    // Reordered: the layout follows the outline, not the old drawing.
    expect(kids(out, 'root')).toEqual(['Venue', 'Agenda', 'Travel']);
    expect(outlineOf(out).split('\n')[1]).toBe('- Travel');
  });

  it('adds a new line as a node that looks like its siblings, joined by a connector', () => {
    const els = offsite();
    const out = applyMindOutline(els, 'root', parse(`${outlineOf(els)}\n  - Ferry`), dress)!;
    const ferry = byLabel(out, 'Ferry');
    expect(ferry.mindParentId).toBe('travel');
    expect(
      out.some(
        (e) =>
          e.type === 'arrow' &&
          e.from.kind === 'pinned' &&
          e.from.elementId === 'travel' &&
          e.to.kind === 'pinned' &&
          e.to.elementId === ferry.id,
      ),
    ).toBe(true);
  });

  it('joins a new node with the connector look of the sibling its own look came from', () => {
    const els = offsite().map((e) =>
      e.id === 'root->travel' ? ({ ...e, strokeColor: '#ec4899' } as Element) : e,
    );
    const out = applyMindOutline(els, 'root', parse(`${outlineOf(els)}\n- Fun`), dress)!;
    const fun = byLabel(out, 'Fun');
    const into = out.find(
      (e) => e.type === 'arrow' && e.to.kind === 'pinned' && e.to.elementId === fun.id,
    );
    expect((into as ArrowElement).strokeColor).toBe('#ec4899');
  });

  it('removes a node whose line is gone, with its connectors', () => {
    const els = offsite();
    const text = outlineOf(els).replace('\n  - Day 1', '');
    expect(summariseMindOutline(els, 'root', parse(text)).removed.map((n) => n.id)).toEqual([
      'day1',
    ]);
    const out = applyMindOutline(els, 'root', parse(text), dress)!;
    expect(out.some((e) => e.id === 'day1' || e.id === 'agenda->day1')).toBe(false);
  });

  it('moves a node to a new parent, keeping its id, and re-joins its connector', () => {
    const els = offsite();
    const text = 'Team offsite\n- Venue\n  - Lake District\n  - Day 1\n- Agenda\n- Travel';
    const out = applyMindOutline(els, 'root', parse(text), dress)!;
    expect(shape(out, 'day1').mindParentId).toBe('venue');
    expect(out.some((e) => e.id === 'agenda->day1')).toBe(false);
    expect(summariseMindOutline(els, 'root', parse(text)).moved).toBe(1);
  });

  it('renames the node in the same place when its text changed, keeping its id', () => {
    const els = offsite();
    const text = outlineOf(els).replace('- Travel', '- Getting there');
    const summary = summariseMindOutline(els, 'root', parse(text));
    expect(summary).toMatchObject({ added: 0, renamed: 1, removed: [] });
    const out = applyMindOutline(els, 'root', parse(text), dress)!;
    expect(shape(out, 'travel').label).toBe('Getting there');
  });

  it('keeps a node of several lines, and its formatting, when its joined line is unchanged', () => {
    const els = offsite().map((e) =>
      e.id === 'root'
        ? ({ ...e, label: 'Team offsite\nLake District', richText: [{ text: 'x' }] } as Element)
        : e,
    );
    const text = outlineOf(els);
    expect(text.split('\n')[0]).toBe('Team offsite Lake District');
    expect(summariseMindOutline(els, 'root', parse(text)).renamed).toBe(0);
    expect(applyMindOutline(els, 'root', parse(text), dress)).toBeNull();
  });

  it('only applies to a root', () => {
    expect(applyMindOutline(offsite(), 'venue', parse('Venue'), dress)).toBeNull();
  });
});
