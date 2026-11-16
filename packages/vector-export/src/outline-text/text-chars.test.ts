// @vitest-environment jsdom
// livedesign/docs/specs/007-editor/logo-pages.md "Outlined text": typed characters mapped to the indices the SVG DOM
// addresses once white space collapses.
import { describe, expect, it } from 'vitest';
import { addressableChars, drawsNothing } from './text-chars';

function nodes(...parts: string[]): Text[] {
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  for (const p of parts) {
    const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    span.textContent = p;
    text.appendChild(span);
  }
  return [...text.childNodes].map((n) => n.firstChild as Text);
}

const indices = (chars: ReturnType<typeof addressableChars>) => chars?.map((c) => c.index);

describe('addressableChars', () => {
  it('collapses as xml:space default does: newlines out, runs of spaces as one, the ends trimmed', () => {
    const chars = addressableChars(nodes('  a\n  b', '\tc  '), 5);
    expect(chars?.filter((c) => c.index >= 0).map((c) => c.ch)).toEqual(['a', ' ', 'b', '\t', 'c']);
    expect(indices(chars)).toEqual([-1, -1, 0, -1, 1, -1, 2, 3, 4, -1, -1]);
  });

  it('keeps every character when the browser counted them all', () => {
    expect(indices(addressableChars(nodes(' a  b '), 6))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('is null when neither count fits', () => {
    expect(addressableChars(nodes('a  b'), 7)).toBeNull();
  });

  it('splits a surrogate pair into its two units, the first carrying the character', () => {
    const chars = addressableChars(nodes('😀b'), 3)!;
    expect(chars.map((c) => [c.ch, c.index])).toEqual([
      ['😀', 0],
      ['', 1],
      ['b', 2],
    ]);
    expect(chars[0]!.holder.localName).toBe('tspan');
  });

  it('skips a text node with no element around it', () => {
    expect(addressableChars([document.createTextNode('x')], 0)).toEqual([]);
  });
});

describe('drawsNothing', () => {
  it('is true for white space, bidi marks and the empty second unit', () => {
    expect(['', ' ', ' ', '‎', '‍'].every(drawsNothing)).toBe(true);
    expect(['a', '字', '😀'].some(drawsNothing)).toBe(false);
  });
});
