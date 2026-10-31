import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The home page's drawings and the legal pages' section numbers are real text a person reads, so they meet WCAG AA
// like any other: a collaborator's name tag is white on its colour, and small grey text is slate-500 on light (slate-400
// is 2.6:1 on white), slate-400 on dark.
const here = new URL('./', import.meta.url);
const files = [
  ...readdirSync(here)
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => new URL(f, here)),
  new URL('../LegalPage.tsx', here),
];
const sources = files.map((url) => ({
  file: url.pathname.split('/').pop()!,
  text: readFileSync(url, 'utf8'),
}));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const onWhiteText = (hex: string) => 1.05 / (luminance(hex) + 0.05);

// Every literal `colour` a cursor is given: `colour="#…"` or `colour: '#…'`.
function cursorColours(text: string): string[] {
  const out: string[] = [];
  let at = text.indexOf('colour');
  while (at !== -1) {
    const hash = text.indexOf('#', at);
    const between = text.slice(at + 'colour'.length, hash);
    if (hash !== -1 && between.length <= 3 && /^[=:]\s?["']$/.test(between))
      out.push(text.slice(hash, hash + 7));
    at = text.indexOf('colour', at + 1);
  }
  return out;
}

// Every className string's classes.
function classLists(text: string): string[][] {
  const out: string[][] = [];
  let at = text.indexOf('className="');
  while (at !== -1) {
    const start = at + 'className="'.length;
    const end = text.indexOf('"', start);
    out.push(text.slice(start, end).split(/\s+/));
    at = text.indexOf('className="', end);
  }
  return out;
}

// The drawings that are dark in both appearances (KeyArt's terminal, slate-950), where slate-400 is the readable grey.
const DARK_SURFACES = ['export function KeyArt('];
function withoutDarkSurfaces(text: string): string {
  let out = text;
  for (const marker of DARK_SURFACES) {
    const start = out.indexOf(marker);
    if (start === -1) continue;
    const next = out.indexOf('\nexport ', start + marker.length);
    out = out.slice(0, start) + (next === -1 ? '' : out.slice(next));
  }
  return out;
}

const SMALL = new Set(['text-[10px]', 'text-[11px]', 'text-xs', 'text-sm']);

describe('the landing drawings and legal pages', () => {
  it('give every cursor a name tag that white text reads on at AA', () => {
    const colours = sources.flatMap((s) => cursorColours(s.text).map((c) => [s.file, c] as const));
    expect(colours.length).toBeGreaterThan(0);
    for (const [file, colour] of colours)
      expect(onWhiteText(colour), `${file} ${colour}`).toBeGreaterThanOrEqual(4.5);
  });

  it('never set small text in slate-400 on a light page', () => {
    for (const { file, text } of sources)
      for (const classes of classLists(withoutDarkSurfaces(text)))
        if (classes.includes('text-slate-400') && classes.some((c) => SMALL.has(c)))
          expect.fail(`${file}: ${classes.join(' ')}`);
  });
});
