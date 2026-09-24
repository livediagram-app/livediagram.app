import { describe, expect, it } from 'vitest';
import {
  CODE_THEMES,
  DEFAULT_CODE_THEME,
  codeTheme,
  isCodeThemeId,
  type CodeTheme,
} from './code-themes';

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
