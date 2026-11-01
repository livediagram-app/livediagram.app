import { describe, expect, it } from 'vitest';
import { cleanText, clipText, trimInvisible, withoutBidiControls } from './typed-text';

// CPU time, not wall time, so a busy machine can't fail a speed test (this package has no Node types of its own).
type Usage = { user: number; system: number };
const { cpuUsage } = (globalThis as unknown as { process: { cpuUsage: (since?: Usage) => Usage } })
  .process;

const isWellFormed = (s: string) =>
  !/\p{Surrogate}/u.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''));

describe('clipText', () => {
  it('never cuts an emoji in half', () => {
    const clipped = clipText(`${'a'.repeat(79)}😀😀`, 80);
    expect(clipped).toBe('a'.repeat(79));
    expect(isWellFormed(clipped)).toBe(true);
  });

  it('keeps a joined emoji whole or leaves it out', () => {
    const family = '🧑‍🤝‍🧑'; // 8 units
    expect(clipText(`abc${family}`, 7)).toBe('abc');
    expect(clipText(`abc${family}`, 11)).toBe(`abc${family}`);
  });

  it('passes short text through untouched', () => {
    expect(clipText('Ops', 80)).toBe('Ops');
  });

  it('clips a long name in linear time', () => {
    const long = '😀'.repeat(200_000);
    const start = cpuUsage();
    expect(clipText(long, 80)).toHaveLength(80);
    const { user, system } = cpuUsage(start);
    expect((user + system) / 1000).toBeLessThan(500);
  });
});

describe('withoutBidiControls', () => {
  it('takes out every embedding, override and isolate, and keeps right-to-left letters', () => {
    expect(
      withoutBidiControls('\u202Eevil\u202C \u2067org\u2069 \u202A\u202B\u202D\u2066\u2068'),
    ).toBe('evil org ');
    expect(withoutBidiControls('فريق العمليات')).toBe('فريق العمليات');
  });
});

describe('cleanText', () => {
  it('trims, drops bidi controls and clips whole characters', () => {
    expect(cleanText('  \u202Eevil org  ', 80)).toBe('evil org');
    expect(cleanText(`${'a'.repeat(79)}😀`, 80)).toBe('a'.repeat(79));
  });

  it('takes invisible characters off either end, so no name looks blank', () => {
    for (const blank of ['\u200B\u200B', '\u2060', '\uFEFF', '\u00AD', ' \u200C\u200D ']) {
      expect(cleanText(blank, 80)).toBe('');
    }
    expect(cleanText('\uFEFF x \u200B', 80)).toBe('x');
    // A joined emoji keeps its joiners inside.
    expect(cleanText(' 🧑‍🤝‍🧑 Ops\u200B', 80)).toBe('🧑‍🤝‍🧑 Ops');
  });

  it('trims a long run of invisible characters in linear time', () => {
    const long = `${'\u200B'.repeat(200_000)}x${'\u200B'.repeat(200_000)}`;
    const start = cpuUsage();
    expect(cleanText(long, 80)).toBe('x');
    const { user, system } = cpuUsage(start);
    expect((user + system) / 1000).toBeLessThan(500);
  });
});

describe('trimInvisible', () => {
  it('keeps the inside of a name and drops spaces and format characters at its ends', () => {
    expect(trimInvisible('\u00AD a\u200Bb \u2060')).toBe('a\u200Bb');
    expect(trimInvisible('')).toBe('');
  });
});
