// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { blockTagger } from './article-pdf-tags';
import { snapshotWriting } from './article-snapshot';

// liveworkspace/docs/specs/013-export/vector-pdf.md "Tags": each word of the writing is tagged with the block it is
// in and that block's place in the structure (a heading by its level, a quote, a list item in its list, a cell in its
// row), blocks numbered in document order.

const li = (id: string, level: number, kind = 'bullet') =>
  `<li id="${id}" class="article-list" data-level="${level}" data-article-list="${kind}">${id}</li>`;

function writing(html: string) {
  const root = document.createElement('div');
  root.innerHTML = html;
  const tags = blockTagger();
  tags.scan(root);
  return { root, tags, at: (id: string) => tags.of(root.querySelector(`#${id}`)) };
}

afterEach(() => document.body.replaceChildren());

describe('blockTagger', () => {
  it('tags headings by level, quotes and other blocks, numbering each block once in document order', () => {
    const { tags, at } = writing(
      '<h2><span id="a">Title</span></h2><p><b id="b">bold</b> <i id="c">word</i></p><blockquote id="q">said</blockquote><pre id="d">code</pre><div id="e">loose</div>',
    );
    // Asked out of order: the numbers are the document's.
    expect(at('d')).toEqual({ tag: 'P', block: 3 });
    expect(at('a')).toEqual({ tag: 'H2', block: 0 });
    expect(at('b')).toEqual({ tag: 'P', block: 1 });
    expect(at('c')).toEqual({ tag: 'P', block: 1 });
    expect(at('q')).toEqual({ tag: 'BlockQuote', block: 2 });
    expect(at('e')).toBeNull();
    expect(tags.of(null)).toBeNull();
  });

  it('rebuilds the flat writing’s lists: a run is one list, a deeper level a list in its item’s body', () => {
    const { at } = writing(
      [
        li('a', 0),
        li('b', 0),
        li('c', 1),
        li('d', 1, 'numbered'),
        li('e', 3),
        li('f', 0),
        '<p id="p">between</p>',
        li('g', 0),
        li('h', 0, 'todo'),
      ].join(''),
    );
    expect(at('a')).toEqual({ tag: 'L#l0/LI#i0/LBody', block: 0 });
    expect(at('b')).toEqual({ tag: 'L#l0/LI#i1/LBody', block: 1 });
    expect(at('c')).toEqual({ tag: 'L#l0/LI#i1/LBody#1/L#l1/LI#i2/LBody', block: 2 });
    // Another kind at the same level is another list, in the same item.
    expect(at('d')).toEqual({ tag: 'L#l0/LI#i1/LBody#1/L#l2/LI#i3/LBody', block: 3 });
    // A level skipped still nests in the item above it.
    expect(at('e')).toEqual({
      tag: 'L#l0/LI#i1/LBody#1/L#l2/LI#i3/LBody#3/L#l3/LI#i4/LBody',
      block: 4,
    });
    expect(at('f')).toEqual({ tag: 'L#l0/LI#i5/LBody', block: 5 });
    expect(at('p')).toEqual({ tag: 'P', block: 6 });
    // A paragraph ends the list: the next item starts another.
    expect(at('g')).toEqual({ tag: 'L#l4/LI#i7/LBody', block: 7 });
    expect(at('h')).toEqual({ tag: 'L#l5/LI#i8/LBody', block: 8 });
  });

  it('puts a table’s cells in their rows, headers apart, and a lone cell on its own', () => {
    const { tags, at } = writing(
      '<table><tbody><tr><th id="h1">Name</th><th id="h2">Age</th></tr><tr><td id="c1">Ada</td><td id="c2">36</td></tr></tbody></table><table><tbody><tr><td id="t2">x</td></tr></tbody></table>',
    );
    expect(at('h1')).toEqual({ tag: 'Table#t0/TR#r1/TH', block: 0 });
    expect(at('h2')).toEqual({ tag: 'Table#t0/TR#r1/TH', block: 1 });
    expect(at('c1')).toEqual({ tag: 'Table#t0/TR#r2/TD', block: 2 });
    expect(at('c2')).toEqual({ tag: 'Table#t0/TR#r2/TD', block: 3 });
    expect(at('t2')).toEqual({ tag: 'Table#t3/TR#r4/TD', block: 4 });
    expect(tags.of(document.createElement('td'))).toEqual({ tag: 'TD', block: 5 });
    // An item with no level or kind is a list of its own at the top.
    expect(tags.of(document.createElement('li'))).toEqual({ tag: 'L#l0/LI#i6/LBody', block: 6 });
  });

  it('labels a list item’s marker beside its body, and keeps any other tag', () => {
    const tags = blockTagger();
    expect(tags.marker({ tag: 'L#l0/LI#i4/LBody', block: 4 })).toEqual({
      tag: 'L#l0/LI#i4/Lbl#m4',
      block: 4,
    });
    expect(tags.marker({ tag: 'P', block: 2 })).toEqual({ tag: 'P', block: 2 });
  });

  it('numbers a second root’s blocks after the first’s, and a block no scan reached when met', () => {
    const tags = blockTagger();
    const body = document.createElement('div');
    body.innerHTML = '<p>one</p><p>two</p>';
    const notes = document.createElement('div');
    notes.innerHTML = '<p id="n">note</p>';
    tags.scan(body);
    tags.scan(notes);
    tags.scan(body);
    expect(tags.of(notes.querySelector('#n'))).toEqual({ tag: 'P', block: 2 });
    expect(tags.of(document.createElement('h3'))).toEqual({ tag: 'H3', block: 3 });
  });
});

describe('a list’s markers in an export', () => {
  it('reads each marker as its item’s label, numbered in document order, after a heading above it', () => {
    const root = document.body.appendChild(document.createElement('div'));
    root.innerHTML = `<h1></h1><li class="article-list" data-level="0" data-article-list="numbered" data-marker="1."></li>`;
    const ops = snapshotWriting(root, (x, y) => ({ x, y }), 1);
    const marker = ops.find((o) => o.k === 'text');
    expect(marker).toMatchObject({ text: '1.', tag: 'L#l0/LI#i1/Lbl#m1', block: 1 });
  });
});
