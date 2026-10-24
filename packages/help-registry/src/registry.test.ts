import { describe, expect, it } from 'vitest';
import { articleHref, categoryHref } from './hrefs';
import { createHelpRegistry } from './registry';
import { articlePath, createHelpTelemetryIds } from './telemetry';
import { topCategorySlug, type Article, type Category } from './types';

const article = (slug: string, categorySlug: string, rest: Partial<Article> = {}): Article => ({
  slug,
  title: slug,
  description: '',
  keywords: '',
  category: categorySlug,
  categorySlug,
  ...rest,
});

const categories: Category[] = [
  { slug: 'about', title: 'About', description: '', articleCount: 1 },
  {
    slug: 'palette',
    title: 'Palette',
    description: '',
    articleCount: 3,
    kind: 'feature',
    groups: ['Elements', 'Selection Modes'],
  },
];
const articles: Article[] = [
  article('what-is-it', 'about'),
  article('format-painter', 'palette', { title: 'Format Painter', group: 'Selection Modes' }),
  article('shapes', 'palette', { title: 'Shapes', group: 'Elements' }),
  article('loose', 'palette', { title: 'Loose ends' }),
  article('format-painter', 'tips', { title: 'Copying a look', parentSlug: 'tricks' }),
  article('exporting', 'account', {
    title: 'Exporting Diagrams',
    description: 'Save a picture',
    keywords: 'png svg',
  }),
];
const registry = createHelpRegistry(categories, articles);

describe('createHelpRegistry', () => {
  it('lists the feature categories and a category’s articles', () => {
    expect(registry.featureCategories.map((c) => c.slug)).toEqual(['palette']);
    expect(registry.getArticlesByCategory('about').map((a) => a.slug)).toEqual(['what-is-it']);
    expect(registry.getSubArticles('tricks').map((a) => a.title)).toEqual(['Copying a look']);
  });

  it('groups a category in its own order, unnamed groups after', () => {
    expect(registry.getCategoryGroups('palette').map((g) => g.group)).toEqual([
      'Elements',
      'Selection Modes',
      '',
    ]);
    expect(registry.getCategoryGroups('about')).toEqual([{ group: '', articles: [articles[0]] }]);
  });

  it('ranks title starts, then words, then descriptions, keywords and every word', () => {
    expect(registry.searchArticles('format').map((a) => a.title)).toEqual(['Format Painter']);
    expect(registry.searchArticles('picture').map((a) => a.slug)).toEqual(['exporting']);
    expect(registry.searchArticles('svg').map((a) => a.slug)).toEqual(['exporting']);
    expect(registry.searchArticles('export png').map((a) => a.slug)).toEqual(['exporting']);
    expect(registry.searchArticles('nothing here')).toEqual([]);
  });
});

describe('help telemetry ids', () => {
  const ids = createHelpTelemetryIds({ 'tips/format-painter': 'tips-format-painter' });

  it('is the slug unless the article is overridden', () => {
    expect(ids.articleTelemetryId(articles[1]!)).toBe('format-painter');
    expect(ids.articleTelemetryId(articles[4]!)).toBe('tips-format-painter');
    expect(articlePath(articles[4]!)).toBe('tips/format-painter');
  });

  it('reads a path with or without its slashes', () => {
    expect(ids.helpPathTelemetryId('/tips/format-painter/')).toBe('tips-format-painter');
    expect(ids.helpPathTelemetryId('palette/shapes')).toBe('shapes');
    expect(ids.helpPathTelemetryId('/palette/')).toBe('palette');
  });
});

describe('paths', () => {
  it('builds trailing-slash hrefs and finds the top category', () => {
    expect(articleHref(articles[2]!)).toBe('/palette/shapes/');
    expect(categoryHref('canvas/the-canvas')).toBe('/canvas/the-canvas/');
    expect(topCategorySlug('palette/tools/data')).toBe('palette');
  });
});
