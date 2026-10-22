import { describe, it, expect } from 'vitest';
import { xmlEscape } from './xml';

// The escaper had three separate implementations across two packages and no
// test in any of them. These pin the contract the single one now owes every
// SVG builder that calls it.
describe('xmlEscape', () => {
  it('escapes the five XML significant characters', () => {
    expect(xmlEscape('&')).toBe('&amp;');
    expect(xmlEscape('<')).toBe('&lt;');
    expect(xmlEscape('>')).toBe('&gt;');
    expect(xmlEscape('"')).toBe('&quot;');
    expect(xmlEscape("'")).toBe('&#39;');
  });

  it('escapes the ampersand first, so an escape is never double-escaped', () => {
    // & -> &amp; runs before < -> &lt;. The other order would turn "<" into
    // "&lt;" and then its own ampersand into "&amp;lt;", which renders as
    // the literal text "&lt;" instead of a less-than sign.
    expect(xmlEscape('<')).toBe('&lt;');
    expect(xmlEscape('&lt;')).toBe('&amp;lt;');
  });

  it('leaves a string with nothing to escape untouched', () => {
    expect(xmlEscape('Roadmap Q3')).toBe('Roadmap Q3');
    expect(xmlEscape('')).toBe('');
  });

  it('escapes every occurrence, not just the first', () => {
    expect(xmlEscape('a & b & c')).toBe('a &amp; b &amp; c');
  });

  it('escapes a real label exactly', () => {
    // Apostrophes and quotes are the interesting cases: two of the three old
    // escapers left one or both raw, which is what made the output depend on
    // which copy a caller happened to reach for.
    expect(xmlEscape(`Ann's "big" plan <draft> & notes`)).toBe(
      'Ann&#39;s &quot;big&quot; plan &lt;draft&gt; &amp; notes',
    );
  });

  it('leaves nothing behind that could close a tag or an attribute', () => {
    // The property that lets ONE escaper serve both positions a string lands
    // in: a text node, and a single- or double-quoted attribute value.
    const escaped = xmlEscape(`</text><script>alert('x')</script> "quoted"`);
    expect(escaped).not.toMatch(/[<>"']/);
  });
});
