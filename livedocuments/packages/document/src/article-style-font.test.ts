import { describe, expect, it } from 'vitest';
import { articleFontsForTab, withArticlesInFont } from './article-style';
import type { Tab } from './index';

const tab = {
  id: 't',
  name: 'T',
  elements: [],
  articles: {
    a: { blocks: [], style: { look: 'classic', headingFont: 'oswald', bodyFont: 'roboto-mono' } },
    b: { blocks: [] },
  },
} as unknown as Tab;

describe('an article in the tab’s typeface', () => {
  it('sets paragraphs only in a face long text reads in', () => {
    expect(articleFontsForTab('lora')).toEqual({ headingFont: 'lora', bodyFont: 'lora' });
    expect(articleFontsForTab('abril-fatface')).toEqual({ headingFont: 'abril-fatface' });
  });

  it('restyles every article, keeping its other fields', () => {
    const out = withArticlesInFont(tab, 'caveat');
    expect(out.articles!.a!.style).toEqual({ look: 'classic', headingFont: 'caveat' });
    expect(out.articles!.b!.style).toEqual({ headingFont: 'caveat' });
  });
});
