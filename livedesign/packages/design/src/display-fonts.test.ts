import { describe, expect, it } from 'vitest';
import { googleFontsHref as sharedGoogleFontsHref } from '@liveworkspace/model-core/fonts';
import { DISPLAY_FONT_CATEGORIES, DISPLAY_FONTS } from './display-fonts';
import { ELEMENT_FIELD_VALUES, fieldValueIssue } from './element-field-values';
import {
  displayFontById,
  FONT_IDS,
  FONTS,
  fontIdsUsed,
  googleFontsHref,
  isDisplayFont,
  resolveFontStack,
} from './fonts';

// docs/specs/004-interface-design/fonts.md "The display library", docs/specs/007-editor/logo-pages.md "Display faces".
describe('the display library', () => {
  it('is a closed list of about 50 to 100 faces, none of them one of the eleven', () => {
    expect(DISPLAY_FONTS.length).toBe(90);
    const ids = DISPLAY_FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FONTS) expect(ids).not.toContain(f.id);
  });

  it('names each face by its family, in kebab case, with a stack and a Google spec of that family', () => {
    for (const f of DISPLAY_FONTS) {
      expect(f.id).toBe(f.label.toLowerCase().replace(/ /g, '-'));
      expect(f.stack.startsWith(`'${f.label}', `)).toBe(true);
      expect(f.google.split(':')[0]).toBe(f.label.replace(/ /g, '+'));
      expect(f.google).toMatch(/^[A-Za-z0-9+]+(:wght@(400|500|700)(;(500|700))*)?$/);
    }
  });

  it('sorts by category, in the picker’s order, then by label', () => {
    const order = DISPLAY_FONT_CATEGORIES.map((c) => c.id);
    const keys = DISPLAY_FONTS.map(
      (f) => [order.indexOf(f.category), f.label.toLowerCase()] as const,
    );
    for (const [cat] of keys) expect(cat).toBeGreaterThanOrEqual(0);
    const sorted = [...keys].sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
    expect(keys).toEqual(sorted);
    for (const c of order) expect(DISPLAY_FONTS.some((f) => f.category === c)).toBe(true);
  });
});

describe('livedesign’s font helpers', () => {
  it('resolves a display face, one of the eleven, and nothing for an unset or unknown id', () => {
    expect(resolveFontStack('bebas-neue')).toBe(
      "'Bebas Neue', ui-sans-serif, system-ui, sans-serif",
    );
    expect(resolveFontStack('lora')).toBe(FONTS.find((f) => f.id === 'lora')!.stack);
    expect(resolveFontStack('retired-face')).toBeUndefined();
    expect(resolveFontStack(undefined)).toBeUndefined();
    expect(resolveFontStack(null)).toBeUndefined();
  });

  it('tells a display face from one of the eleven', () => {
    expect(isDisplayFont('pacifico')).toBe(true);
    expect(isDisplayFont('inter')).toBe(false);
    expect(isDisplayFont(undefined)).toBe(false);
    expect(displayFontById('pacifico')?.label).toBe('Pacifico');
    expect(displayFontById('inter')).toBeUndefined();
    expect(displayFontById(null)).toBeUndefined();
  });

  it('keeps the editor’s stylesheet to the eleven, and asks for exactly the families given', () => {
    expect(googleFontsHref()).toBe(sharedGoogleFontsHref());
    expect(googleFontsHref(['lora'])).toBe(sharedGoogleFontsHref(['lora']));
    expect(googleFontsHref(['lobster'])).toBe(
      'https://fonts.googleapis.com/css2?family=Lobster&display=swap',
    );
    expect(googleFontsHref(['montserrat', 'inter'])).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Montserrat:wght@400;500;700&display=swap',
    );
  });

  it('lists the faces a tab uses: the eleven first, then the display faces', () => {
    expect(
      fontIdsUsed([{ font: 'pacifico' }, { font: 'lora' }], 'anton', ['cinzel', null]),
    ).toEqual(['lora', 'anton', 'cinzel', 'pacifico']);
    expect(fontIdsUsed([{ font: 'lora' }, { font: 'nope' }])).toEqual(['lora']);
    expect(fontIdsUsed([{}])).toEqual([]);
  });
});

describe('a font an agent writes', () => {
  it('may be a display face; anything else is refused naming every face', () => {
    expect(ELEMENT_FIELD_VALUES.font).toBe(FONT_IDS);
    expect(FONT_IDS.slice(0, FONTS.length)).toEqual(FONTS.map((f) => f.id));
    expect(fieldValueIssue('font', 'great-vibes')).toBeNull();
    expect(fieldValueIssue('font', undefined)).toBeNull();
    expect(fieldValueIssue('font', null)).toBeNull();
    expect(fieldValueIssue('font', 'Lobster')).toMatch(
      /^font "Lobster" is not one of inter, .*, lobster,/,
    );
  });

  it('leaves every other field to the shared check', () => {
    expect(ELEMENT_FIELD_VALUES.textSize).toEqual(['sm', 'md', 'lg', 'scale']);
    expect(fieldValueIssue('textSize', 'xl')).toMatch(/^textSize "xl" is not one of/);
    expect(fieldValueIssue('textSize', 'md')).toBeNull();
  });
});
