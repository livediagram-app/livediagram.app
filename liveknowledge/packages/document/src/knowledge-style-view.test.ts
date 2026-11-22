import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import {
  DEFAULT_KNOWLEDGE_STYLE,
  knowledgeArticleStyle,
  type KnowledgeStyle,
} from './knowledge-style';
import {
  LIME_ACCENT,
  isWarmAccent,
  knowledgeThemeAccent,
  writingAccentOf,
} from './knowledge-accent';
import {
  KNOWLEDGE_LIGHT_GROUND,
  knowledgeChromeAccent,
  knowledgeGroundWash,
  knowledgeLightGround,
  knowledgeWritingAccent,
  tabInKnowledgeStyle,
  tabOnKnowledgeGround,
} from './knowledge-style-view';
import { pagesOf } from './page';
import type { Tab } from './index';

// docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style": one copy of what a style looks like, for the
// editor's exports and the api's preview alike.
const STEEL: KnowledgeStyle = { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'steel' };
const OCEAN: KnowledgeStyle = { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'ocean', bodyFont: 'lora' };

describe('a theme’s accent', () => {
  it('is lime for the product’s own, the stroke for a one-colour theme', () => {
    expect(knowledgeThemeAccent('brand')).toBe(LIME_ACCENT);
    expect(knowledgeThemeAccent(undefined)).toBe(LIME_ACCENT);
    expect(knowledgeThemeAccent('forest')).toMatch(/^#[0-9a-f]{6}$/);
    expect(knowledgeThemeAccent('forest')).not.toBe(LIME_ACCENT);
  });

  it('is a multi-colour theme’s first branch that is neither red nor amber', () => {
    // Rainbow: red, orange, amber, then green. Tropical leads with teal. Yuletide: red, then green.
    expect(knowledgeThemeAccent('rainbow')).toBe('#16a34a');
    expect(knowledgeThemeAccent('tropical')).toBe('#0d9488');
    expect(knowledgeThemeAccent('yuletide')).toBe('#15803d');
  });

  it('is the first branch when every branch is warm, and the theme’s own with no branches', () => {
    expect(
      writingAccentOf({ palette: [{ stroke: '#dc2626' }, { stroke: '#f59e0b' }] } as never),
    ).toBe('#dc2626');
    expect(writingAccentOf({ elementStroke: '#0369a1' })).toBe('#0369a1');
  });

  it('reads red through yellow as warm, and a grey or a blue as not', () => {
    expect(isWarmAccent('#dc2626')).toBe(true);
    expect(isWarmAccent('#ec4899')).toBe(true);
    expect(isWarmAccent('#fc0')).toBe(true);
    expect(isWarmAccent('#2563eb')).toBe(false);
    expect(isWarmAccent('#16a34a')).toBe(false);
    expect(isWarmAccent('#777777')).toBe(false);
    expect(isWarmAccent('not a colour')).toBe(false);
  });

  it('is the picked accent for the writing, else the theme’s', () => {
    expect(knowledgeWritingAccent({ theme: 'ocean', accent: '#7c3aed' })).toBe('#7c3aed');
    expect(knowledgeWritingAccent({ theme: 'ocean' })).toBe(knowledgeThemeAccent('ocean'));
  });

  it('gives the chrome nothing under the product’s own theme, and a ramp that carries text under any other', () => {
    expect(knowledgeChromeAccent('brand')).toBeNull();
    expect(knowledgeChromeAccent(undefined)).toBeNull();
    for (const theme of ['steel', 'ocean', 'pastel', 'rose']) {
      const accent = knowledgeChromeAccent(theme)!;
      expect(contrastRatio('#ffffff', accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the light ground', () => {
  it('is white under the product’s own theme and a pale wash of the theme under another', () => {
    expect(knowledgeLightGround('brand')).toBe(KNOWLEDGE_LIGHT_GROUND);
    const steel = knowledgeLightGround('steel');
    expect(steel).not.toBe(KNOWLEDGE_LIGHT_GROUND);
    expect(steel).toBe(knowledgeGroundWash(knowledgeChromeAccent('steel')!));
    expect(steel).not.toBe(knowledgeLightGround('ocean'));
    // Pale enough that the body ink keeps its contrast.
    expect(contrastRatio('#1e293b', steel)).toBeGreaterThanOrEqual(12);
  });
});

describe('a tab as the exports and the preview draw it', () => {
  const tab = {
    id: 't1',
    name: 'Release Process',
    elements: [],
    pages: [
      {
        id: 'p1',
        orientation: 'portrait',
        size: 'fit',
        fit: { width: 856, height: 400 },
        kind: 'article',
        flow: 'art-1',
      },
    ],
    articles: {
      'art-1': { blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text: 'Ship on Tuesdays.' }] }] },
    },
  } as unknown as Tab;

  it('wears the knowledgebase’s theme, typeface, article style and accent, and leaves the stored tab as it was', () => {
    const style: KnowledgeStyle = { ...OCEAN, textSize: 'large', headingStyle: 'ruled' };
    const frozen = JSON.stringify(tab);
    const styled = tabInKnowledgeStyle(tab, style);
    expect(styled.theme).toBe('ocean');
    expect(styled.font).toBe('lora');
    const flow = (styled.articles as Record<string, { style?: Record<string, unknown> }>)['art-1']!;
    expect(flow.style).toMatchObject({
      ...knowledgeArticleStyle(style),
      bodyFont: 'lora',
      textSize: 'large',
      rules: 'headings',
      margins: 'narrow',
      accent: knowledgeThemeAccent('ocean'),
    });
    expect(JSON.stringify(tab)).toBe(frozen);
    expect(tab).not.toHaveProperty('theme');
    // The same tab and style: the same view, so nothing downstream redraws.
    expect(tabInKnowledgeStyle(tab, style)).toBe(styled);
    expect(tabInKnowledgeStyle(tab, STEEL)).not.toBe(styled);
  });

  it('writes the product’s own lime as the accent, and a picked one over the theme’s', () => {
    const accentOf = (t: Tab) =>
      (t.articles as Record<string, { style?: { accent?: string } }>)['art-1']!.style!.accent;
    expect(accentOf(tabInKnowledgeStyle(tab, DEFAULT_KNOWLEDGE_STYLE))).toBe(LIME_ACCENT);
    expect(accentOf(tabInKnowledgeStyle(tab, { ...OCEAN, accent: '#7c3aed' }))).toBe('#7c3aed');
  });

  it('keeps a tab with no writing free of articles', () => {
    const bare = { id: 't2', name: 'Bare', elements: [] } as unknown as Tab;
    expect(tabInKnowledgeStyle(bare, STEEL)).not.toHaveProperty('articles');
  });

  it('stands its pages on the theme’s ground, keeping a page’s own fill and the white paper under lime', () => {
    expect(tabOnKnowledgeGround(tab, DEFAULT_KNOWLEDGE_STYLE)).toBe(tab);
    const grounded = tabOnKnowledgeGround(tab, STEEL);
    expect(pagesOf(grounded)[0]!.background?.fill).toEqual({
      kind: 'solid',
      color: knowledgeLightGround('steel'),
    });
    const own = {
      ...tab,
      pages: [
        { ...(tab.pages![0] as object), background: { fill: { kind: 'solid', color: '#000000' } } },
      ],
    } as unknown as Tab;
    expect(pagesOf(tabOnKnowledgeGround(own, STEEL))[0]!.background?.fill).toEqual({
      kind: 'solid',
      color: '#000000',
    });
    // A tab stored with no page list stands its one page on the ground too.
    const legacy = { id: 't3', name: 'Old', elements: [] } as unknown as Tab;
    expect(pagesOf(tabOnKnowledgeGround(legacy, STEEL))[0]!.background?.fill).toMatchObject({
      color: knowledgeLightGround('steel'),
    });
  });
});
