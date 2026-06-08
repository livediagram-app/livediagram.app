import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT_STACK, FONTS, fontLabel, googleFontsHref, resolveFontStack } from './fonts';

// The generic CSS families a stack is allowed to terminate in. spec/28:
// fonts are a progressive enhancement, so every stack must end in one of
// these so text still renders when Google Fonts is blocked / opted out.
const GENERIC_FALLBACKS = ['sans-serif', 'serif', 'monospace', 'cursive'];

describe('FONTS catalogue invariants', () => {
  it('has unique, non-empty ids', () => {
    const ids = FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toBeTruthy();
  });

  it('quotes the Google family as the first entry of each stack', () => {
    for (const f of FONTS) {
      const first = f.stack.split(',')[0]!.trim();
      expect(first.startsWith("'")).toBe(true);
      expect(first.endsWith("'")).toBe(true);
    }
  });

  it('every stack ends in a generic CSS fallback (progressive enhancement)', () => {
    for (const f of FONTS) {
      const last = f.stack.split(',').pop()!.trim();
      expect(GENERIC_FALLBACKS).toContain(last);
    }
  });

  it('every Google family spec covers the editor weights 400 / 500 / 700', () => {
    for (const f of FONTS) {
      expect(f.google).toContain('wght@400;500;700');
    }
  });
});

describe('fontLabel', () => {
  it('returns the label for a known id', () => {
    expect(fontLabel('inter')).toBe('Inter');
    expect(fontLabel('roboto-mono')).toBe('Roboto Mono');
  });

  it("returns 'Default' for unset / empty / unknown ids", () => {
    expect(fontLabel(null)).toBe('Default');
    expect(fontLabel(undefined)).toBe('Default');
    expect(fontLabel('')).toBe('Default');
    expect(fontLabel('not-a-real-font')).toBe('Default');
  });
});

describe('resolveFontStack', () => {
  it('maps a known id to its CSS stack', () => {
    expect(resolveFontStack('lora')).toBe("'Lora', ui-serif, Georgia, serif");
  });

  it('resolves every catalogue id to its own stack', () => {
    for (const f of FONTS) expect(resolveFontStack(f.id)).toBe(f.stack);
  });

  it('returns undefined (NOT the default stack) for unset / unknown ids', () => {
    // The element -> tab -> CSS-default fallback chain in the renderers
    // depends on this being undefined for an unchosen font, so a tab font
    // can win over the editor default. Returning DEFAULT_FONT_STACK here
    // would silently pin every unstyled element to the editor default and
    // break per-tab fonts.
    expect(resolveFontStack(null)).toBeUndefined();
    expect(resolveFontStack(undefined)).toBeUndefined();
    expect(resolveFontStack('')).toBeUndefined();
    expect(resolveFontStack('nope')).toBeUndefined();
  });
});

describe('googleFontsHref', () => {
  it('is a single css2 request with display=swap covering every family', () => {
    const href = googleFontsHref();
    expect(href.startsWith('https://fonts.googleapis.com/css2?')).toBe(true);
    expect(href).toContain('display=swap');
    for (const f of FONTS) expect(href).toContain(`family=${f.google}`);
  });

  it('lists exactly one family= entry per catalogue font', () => {
    expect(googleFontsHref().match(/family=/g)?.length).toBe(FONTS.length);
  });
});

describe('DEFAULT_FONT_STACK', () => {
  it('is a pure system stack (no Google family) so unstyled text needs no fetch', () => {
    expect(DEFAULT_FONT_STACK).toBe('ui-sans-serif, system-ui, sans-serif');
    expect(DEFAULT_FONT_STACK).not.toContain("'");
  });
});
