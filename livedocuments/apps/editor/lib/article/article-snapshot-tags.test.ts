// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blockTagger } from './article-snapshot';

// liveworkspace/docs/specs/013-export/vector-pdf.md "Tags": each word of the writing is tagged with the block it is
// in (a heading by its level, any other block a paragraph), blocks numbered in the order they are first met.
describe('blockTagger', () => {
  it('tags headings by level and other blocks as paragraphs, numbering each block once', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<h2><span id="a">Title</span></h2><p><b id="b">bold</b> <i id="c">word</i></p><ul><li id="d">item</li></ul><div id="e">loose</div>';
    const tag = blockTagger();
    const at = (id: string) => tag(root.querySelector(`#${id}`));
    expect(at('a')).toEqual({ tag: 'H2', block: 0 });
    expect(at('b')).toEqual({ tag: 'P', block: 1 });
    expect(at('c')).toEqual({ tag: 'P', block: 1 });
    expect(at('d')).toEqual({ tag: 'P', block: 2 });
    expect(at('a')).toEqual({ tag: 'H2', block: 0 });
    expect(at('e')).toBeNull();
    expect(tag(null)).toBeNull();
  });
});
