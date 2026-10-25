import { createHelpRegistry, type Article, type Category } from '@liveworkspace/help-registry';
import type { HelpClient } from '../client';
import { createHelpSite } from '../site';
import type { HelpSiteConfig } from '../types';

// A small help centre in the shape a product writes, for the package's own tests: two feature categories (one
// grouped), a support category, nested sub-articles and a title with a key symbol.

export const CATEGORIES: Category[] = [
  {
    slug: 'canvas',
    title: 'Canvas',
    description: 'All about the canvas.',
    articleCount: 3,
    kind: 'feature',
    groups: ['Basics', 'Style'],
  },
  {
    slug: 'tools',
    title: 'Tools',
    description: 'The tools that tidy a tab.',
    articleCount: 1,
    kind: 'feature',
  },
  { slug: 'troubleshooting', title: 'Troubleshooting', description: 'Fixes.', articleCount: 1 },
];

const article = (
  a: Partial<Article> & Pick<Article, 'slug' | 'title' | 'categorySlug'>,
): Article => ({
  description: `${a.title}, explained in a sentence long enough to read as a description.`,
  keywords: 'words',
  category: a.categorySlug,
  ...a,
});

export const ARTICLES: Article[] = [
  article({ slug: 'adding', title: 'Adding Elements', categorySlug: 'canvas', group: 'Basics' }),
  article({ slug: 'themes', title: 'Themes', categorySlug: 'canvas', group: 'Style' }),
  article({ slug: 'export', title: 'Exporting a Tab', categorySlug: 'canvas', group: 'Style' }),
  article({
    slug: 'legend',
    title: 'Legend',
    categorySlug: 'canvas/themes',
    parentSlug: 'themes',
  }),
  article({ slug: 'palette', title: 'The Command Palette (⌘K)', categorySlug: 'tools' }),
  article({ slug: 'not-loading', title: 'Not Loading', categorySlug: 'troubleshooting' }),
];

const registry = createHelpRegistry(CATEGORIES, ARTICLES);

export const CONFIG: HelpSiteConfig = {
  siteName: 'testapp',
  siteUrl: 'https://testapp.example',
  contactFormUrl: 'https://testapp.example/form/contact',
  catalogue: {
    articles: ARTICLES,
    categories: CATEGORIES,
    getCategoryGroups: registry.getCategoryGroups,
  },
  art: {
    featureHex: { themes: '#d946ef' },
    categoryHex: { canvas: '#0ea5e9' },
    featureIcons: { themes: <svg data-icon="themes" /> },
    categoryIcons: { canvas: <svg data-icon="canvas" /> },
    featureFallback: <svg data-icon="fallback" />,
    supportIcons: { 'not-loading': <svg data-icon="not-loading" /> },
    supportFallback: <svg data-icon="document" />,
    categoryArt: {},
  },
  // The products' pageMetadata, reduced to what the help centre passes it.
  pageMetadata: ({ title, description, path, siteName, image }) => ({
    title,
    description,
    alternates: { canonical: path },
    openGraph: { url: path, siteName, title, description },
    twitter: { images: [image ? image.url : 'https://testapp.example/twitter-image'] },
  }),
  cardSubtitle: (text) => (text.length > 120 ? `${text.slice(0, 119)}…` : text),
};

export const SITE = createHelpSite(CONFIG);

export const CLIENT: HelpClient = {
  facts: SITE.facts,
  track: () => {},
  helpPathTelemetryId: (path) => path.split('/').filter(Boolean).pop() ?? '',
  loadSearch: async () => registry.searchArticles,
};
