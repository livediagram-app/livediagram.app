import { describe, expect, it } from 'vitest';
import {
  CODE_THEMES,
  DEFAULT_CODE_THEME,
  codeTheme,
  isCodeThemeId,
  type CodeTheme,
} from './code-themes';
import { svgCodeBlockShape } from './svg-render-shapes';

// The scheme ids are STORED on elements, so they are permanent. Everything
// here is about a stored id surviving: an unknown one (older file, hand edit,
// a scheme dropped later) must still render a card rather than an undefined
// colour, and the default must keep pointing at the look the block shipped
// with so untouched diagrams don't change appearance.

const CHANNELS: (keyof CodeTheme)[] = [
  'surface',
  'border',
  'text',
  'muted',
  'keyword',
  'string',
  'comment',
  'number',
];

describe('code themes', () => {
  it('gives every scheme a full set of colours', () => {
    for (const theme of CODE_THEMES) {
      for (const key of CHANNELS) expect(theme[key]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.name.length).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    expect(new Set(CODE_THEMES.map((t) => t.id)).size).toBe(CODE_THEMES.length);
  });

  it('defaults to the dark card the block shipped with', () => {
    expect(DEFAULT_CODE_THEME).toBe('midnight');
    // The exact colours of the original hardcoded card, so an untouched block
    // renders byte-for-byte what it did before schemes existed.
    expect(codeTheme(undefined)).toMatchObject({
      surface: '#0f172a',
      border: '#334155',
      text: '#e2e8f0',
      muted: '#64748b',
    });
  });

  it('falls back rather than returning undefined for an unknown id', () => {
    expect(codeTheme('nonsense')).toBe(codeTheme(DEFAULT_CODE_THEME));
  });

  it('recognises exactly the ids it ships', () => {
    for (const theme of CODE_THEMES) expect(isCodeThemeId(theme.id)).toBe(true);
    expect(isCodeThemeId('nonsense')).toBe(false);
    expect(isCodeThemeId(undefined)).toBe(false);
  });
});

// Long-line wrapping in the STILL render (spec/82). The canvas wraps with CSS;
// an export has to lay the lines out itself, and it must land on the same
// amount of code or a shared thumbnail shows a different snippet than the
// board does.
describe('code block wrapping (headless render)', () => {
  const block = (over: Record<string, unknown>) =>
    ({
      id: 'c',
      type: 'shape',
      shape: 'code-block',
      x: 0,
      y: 0,
      width: 200,
      height: 300,
      ...over,
    }) as never;

  it('breaks a long line across several lines by default', () => {
    const svg = svgCodeBlockShape(block({ code: 'a'.repeat(200) }));
    expect(svg.match(/<text/g)?.length).toBeGreaterThan(1);
  });

  it('keeps a long line on one line when wrapping is off', () => {
    const svg = svgCodeBlockShape(block({ code: 'a'.repeat(200), codeWrap: false }));
    expect(svg.match(/<text/g)?.length).toBe(1);
  });

  it('prefers a space to breaking mid-word', () => {
    const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor';
    const svg = svgCodeBlockShape(block({ code: words }));
    // No rendered line may start or end mid-word when spaces were available.
    const lines = [...svg.matchAll(/>([^<]*)<\/text>/g)].map((m) => m[1]!);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.startsWith(' ')).toBe(false);
  });
});
