// docs/specs/007-editor/logo-pages.md "Outlined text": the faces an embedded stylesheet declares, read by a scan.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { parseFontFaces, parseUnicodeRange } from './font-face-css';

const DATA = 'data:font/woff2;base64,d09GMgAB';

describe('parseUnicodeRange', () => {
  it('reads single points, ranges and wildcards, and skips what is malformed', () => {
    expect(parseUnicodeRange('U+0000-00FF, U+0131, u+02??, nonsense, U+ZZ, U+1-ZZ')).toEqual([
      [0, 0xff],
      [0x131, 0x131],
      [0x200, 0x2ff],
    ]);
  });
});

describe('parseFontFaces', () => {
  it('reads each face, its data URL whole (a semicolon inside it is not a declaration end)', () => {
    const css = `/* latin */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 400 900;
  src: url(${DATA}) format('woff2');
  unicode-range: U+0000-00FF;
}
@font-face { font-family: "Lobster"; src: url("${DATA}"); font-weight: bold }
@font-face { font-family: Odd; font-style: oblique 10deg; font-weight: heavy; src: url(${DATA}) }`;
    expect(parseFontFaces(css)).toEqual([
      {
        family: 'Playfair Display',
        weight: [400, 900],
        style: 'italic',
        ranges: [[0, 0xff]],
        url: DATA,
      },
      {
        family: 'Lobster',
        weight: [700, 700],
        style: 'normal',
        ranges: [[0, 0x10ffff]],
        url: DATA,
      },
      { family: 'Odd', weight: [400, 400], style: 'oblique', ranges: [[0, 0x10ffff]], url: DATA },
    ]);
  });

  it('skips a face with no family or no file, and stops at an unclosed block', () => {
    const css = `@font-face { src: url(${DATA}) } @font-face { font-family: A; src: local(A) }
@font-face { font-family: B; font-weight: normal; src: url(${DATA}) } @font-face { font-family: C; src: url(x`;
    expect(parseFontFaces(css).map((f) => [f.family, f.weight])).toEqual([['B', [400, 400]]]);
    expect(parseFontFaces('@font-face { font-family: D; src: url(abc')).toEqual([]);
    expect(parseFontFaces('@font-face')).toEqual([]);
  });

  it('stays linear over a large stylesheet', () => {
    const block = `@font-face { font-family: 'F'; src: url(data:font/woff2;base64,${'A'.repeat(200_000)}); }\n`;
    const css = block.repeat(40);
    expect(cpuMsOf(() => parseFontFaces(css))).toBeLessThan(400);
  });
});
