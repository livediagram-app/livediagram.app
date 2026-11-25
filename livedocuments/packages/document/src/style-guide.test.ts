import { describe, expect, it } from 'vitest';
import { FINISHES } from '@liveworkspace/element-model/finish';
import { FONTS } from '@liveworkspace/model-core/fonts';
import { THEMES } from './themes';
import { PAGE_DESIGN_IDS } from './page-designs/catalogue';
import {
  DESIGN_GUIDE,
  FINISH_GUIDE,
  FONT_GUIDE,
  STYLE_RECIPES,
  THEME_GUIDE,
  pickStyleRecipe,
  styleGuideMarkdown,
} from './style-guide';

describe('style guide', () => {
  it('describes every theme, design, typeface and finish, and nothing else', () => {
    expect(Object.keys(THEME_GUIDE).sort()).toEqual(THEMES.map((t) => t.id).sort());
    expect(Object.keys(DESIGN_GUIDE).sort()).toEqual([...PAGE_DESIGN_IDS].sort());
    expect(Object.keys(FONT_GUIDE).sort()).toEqual(FONTS.map((f) => f.id).sort());
    expect(Object.keys(FINISH_GUIDE).sort()).toEqual([...FINISHES].sort());
  });

  it('builds every recipe from real parts', () => {
    for (const r of STYLE_RECIPES) {
      expect(THEME_GUIDE[r.theme], r.id).toBeDefined();
      expect(FONT_GUIDE[r.font], r.id).toBeDefined();
      expect(r.design === 'none' || r.design in DESIGN_GUIDE, r.id).toBe(true);
    }
    expect(new Set(STYLE_RECIPES.map((r) => r.id)).size).toBe(STYLE_RECIPES.length);
  });

  it('picks a recipe for the words', () => {
    expect(pickStyleRecipe('Q3 board report: finance and budget')?.id).toBe('formal-report');
    expect(pickStyleRecipe('Team retro brainstorm')?.id).toBe('workshop');
    expect(pickStyleRecipe('Seed pitch for our startup')?.id).toBe('product-pitch');
    expect(pickStyleRecipe('zzz')).toBeUndefined();
  });

  it('writes every option into the Markdown', () => {
    const md = styleGuideMarkdown({ theme: (id) => id, design: (id) => id, font: (id) => id });
    for (const id of [...PAGE_DESIGN_IDS, ...FINISHES]) expect(md).toContain(`\`${id}\``);
  });
});
