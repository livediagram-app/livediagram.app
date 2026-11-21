import { describe, expect, it } from 'vitest';
import { resolveArticleStyle } from './article-style';
import {
  DEFAULT_KNOWLEDGE_STYLE,
  carriedKnowledgeStyle,
  knowledgeArticleStyle,
  knowledgeStyleWrite,
  parseKnowledgeStyle,
  sameKnowledgeStyle,
  storedKnowledgeStyle,
  type KnowledgeStyle,
} from './knowledge-style';
import { RETIRED_TAB_STYLE_KEYS, withoutPageLooks } from './page-looks';
import { migrateIncomingTab, migrateStoredTab } from './stored-tab';

// docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style".
const STEEL: KnowledgeStyle = {
  theme: 'steel',
  headingFont: 'poppins',
  bodyFont: 'lora',
  textSize: 'large',
  lineSpacing: 'compact',
  headingStyle: 'ruled',
  accent: '#0ea5e9',
};

describe('a knowledgebase’s style', () => {
  it('starts in the Everyday look with the product’s own theme', () => {
    expect(DEFAULT_KNOWLEDGE_STYLE).toEqual({
      theme: 'brand',
      headingFont: 'inter',
      bodyFont: 'inter',
      textSize: 'medium',
      lineSpacing: 'comfortable',
      headingStyle: 'plain',
    });
  });

  it('reads anything it cannot use as the default, and never throws', () => {
    for (const stored of [undefined, null, 7, 'nonsense', '{', '[]', [], {}, { theme: 4 }])
      expect(parseKnowledgeStyle(stored)).toEqual(DEFAULT_KNOWLEDGE_STYLE);
  });

  it('keeps each field it knows and defaults each it does not, from an object or a column’s JSON', () => {
    expect(parseKnowledgeStyle({ ...STEEL, extra: 1 })).toEqual(STEEL);
    expect(parseKnowledgeStyle(JSON.stringify(STEEL))).toEqual(STEEL);
    expect(
      parseKnowledgeStyle({
        theme: 'uml',
        headingFont: 'comic-sans',
        bodyFont: 'nunito',
        textSize: 'huge',
        lineSpacing: 'relaxed',
        headingStyle: 3,
        accent: 'red',
      }),
    ).toEqual({ ...DEFAULT_KNOWLEDGE_STYLE, bodyFont: 'nunito', lineSpacing: 'relaxed' });
    // A seasonal theme is one a knowledgebase can wear, through a seasonal look.
    expect(parseKnowledgeStyle({ theme: 'frost' }).theme).toBe('frost');
    expect(parseKnowledgeStyle({ accent: '#ABC' }).accent).toBe('#abc');
  });

  it('stores nothing for the default, and carries nothing of it', () => {
    expect(storedKnowledgeStyle(DEFAULT_KNOWLEDGE_STYLE)).toBeNull();
    expect(storedKnowledgeStyle(STEEL)).toBe(JSON.stringify(STEEL));
    expect(carriedKnowledgeStyle(DEFAULT_KNOWLEDGE_STYLE)).toEqual({});
    expect(carriedKnowledgeStyle(undefined)).toEqual({});
    expect(carriedKnowledgeStyle('nonsense')).toEqual({});
    expect(carriedKnowledgeStyle(STEEL)).toEqual({ knowledgeStyle: STEEL });
    expect(sameKnowledgeStyle(STEEL, { ...STEEL })).toBe(true);
    expect(sameKnowledgeStyle(STEEL, { ...STEEL, accent: undefined })).toBe(false);
  });

  it('takes a write field by field, strictly, naming the field it refuses', () => {
    const ok = knowledgeStyleWrite(DEFAULT_KNOWLEDGE_STYLE, { theme: 'ocean', textSize: 'small' });
    expect(ok).toEqual({
      ok: true,
      style: { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'ocean', textSize: 'small' },
    });
    expect(knowledgeStyleWrite(STEEL, { accent: null })).toMatchObject({
      ok: true,
      style: { theme: 'steel' },
    });
    const cleared = knowledgeStyleWrite(STEEL, { accent: null });
    expect(cleared.ok && 'accent' in cleared.style).toBe(false);
    for (const [write, field] of [
      [{ theme: 'nope' }, 'theme'],
      [{ headingFont: 1 }, 'headingFont'],
      [{ bodyFont: '' }, 'bodyFont'],
      [{ textSize: 'normal' }, 'textSize'],
      [{ lineSpacing: 'double' }, 'lineSpacing'],
      [{ headingStyle: 'title' }, 'headingStyle'],
      [{ accent: '#12' }, 'accent'],
      [{ look: 'report' }, 'look'],
      [null, 'knowledgeStyle'],
      ['{"theme":"ocean"}', 'knowledgeStyle'],
      [[], 'knowledgeStyle'],
    ] as const) {
      const refused = knowledgeStyleWrite(DEFAULT_KNOWLEDGE_STYLE, write);
      expect(refused).toMatchObject({ ok: false, field });
      expect(!refused.ok && refused.message.length).toBeGreaterThan(10);
    }
  });

  it('draws every page’s writing through the article style machinery, on the 760 px column', () => {
    const r = resolveArticleStyle(knowledgeArticleStyle(STEEL));
    expect(r).toMatchObject({
      headingFont: 'poppins',
      bodyFont: 'lora',
      textSize: 'large',
      lineSpacing: 'single',
      rules: 'headings',
      margins: 'narrow',
      accent: '#0ea5e9',
      accentHeadings: true,
      pageNumbers: false,
    });
    const d = resolveArticleStyle(knowledgeArticleStyle(DEFAULT_KNOWLEDGE_STYLE));
    expect(d).toMatchObject({ textSize: 'normal', lineSpacing: 'onehalf', rules: 'none' });
    expect(d.accent).toBeNull();
    // The same object for the same style, so a flow handed it keeps its identity.
    expect(knowledgeArticleStyle({ ...STEEL })).toBe(knowledgeArticleStyle(STEEL));
  });
});

describe('a tab’s own style is retired', () => {
  const styled = () => ({
    id: 't1',
    name: 'Release Process',
    elements: [],
    theme: 'ocean',
    font: 'lora',
    finish: 'sketch',
    defaultTextSize: 'lg',
    backgroundPattern: 'dots',
    backgroundColor: '#0f172a',
    patternColor: '#334155',
    backgroundOpacity: 0.4,
    backgroundPatternScale: 2,
    backgroundAnimationSpeed: 1.5,
    newPageBackground: { fill: { kind: 'solid', color: '#fef3c7' } },
    keepElementColours: true,
  });

  it('drops the theme, font, finish and surround as a stored tab is read', () => {
    const read = withoutPageLooks(styled()) as Record<string, unknown>;
    for (const key of RETIRED_TAB_STYLE_KEYS) expect(read).not.toHaveProperty(key);
    expect(read).toEqual({ id: 't1', name: 'Release Process', elements: [] });
    expect(migrateStoredTab(styled() as never)).toEqual(read);
    expect(migrateIncomingTab(styled())).toEqual(read);
  });

  it('answers the same tab when it holds none of it', () => {
    const plain = { id: 't1', name: 'Plain', elements: [] };
    expect(withoutPageLooks(plain)).toBe(plain);
  });
});
