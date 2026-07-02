import { describe, expect, it } from 'vitest';
import { FONTS, googleFontsHref, resolveFontStack } from './fonts';

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

  it('every multi-weight Google family spec covers the editor weights 400 / 500 / 700', () => {
    // Most families ship a weight axis and must expose 400/500/700 for the
    // editor's regular/medium/bold text. A single-weight family (no `:wght@`
    // suffix, e.g. Permanent Marker) is allowed and reuses its one face.
    for (const f of FONTS) {
      if (f.google.includes(':wght@')) {
        expect(f.google).toContain('wght@400;500;700');
      } else {
        expect(f.google).not.toContain(':');
      }
    }
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
    // can win over the editor default. Returning a default stack here
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
