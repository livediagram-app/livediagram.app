import { describe, expect, it } from 'vitest';
import { FONTS, googleFontsHref, resolveFontStack } from '@liveworkspace/model-core/fonts';

// The generic CSS families a stack is allowed to terminate in. docs/specs/004-interface-design/fonts.md:
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

  it('every Google family spec loads a regular and a bold, or one heavy weight', () => {
    // A family with several weights must load 400 and 700 for the editor's
    // regular and bold text (500 may fall to 400, as Kalam's does). A loud
    // face (the marker, the display serif) loads one heavy weight and letters
    // regular and bold alike, never a synthesised bold (fonts.md "Legible at
    // every size").
    for (const f of FONTS) {
      const weights = f.google
        .split('wght@')[1]
        ?.split(';')
        .map((w) => w.split(',').pop());
      expect(weights, f.id).toBeDefined();
      if (weights!.length > 1) {
        expect(weights, f.id).toContain('400');
        expect(weights, f.id).toContain('700');
      } else {
        expect(Number(weights![0]), f.id).toBeGreaterThanOrEqual(700);
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
