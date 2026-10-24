import type { Metadata } from 'next';
import type { HelpSite } from '../site';
import { ArticleCard } from './ArticleCard';
import { BrowsePage } from './BrowsePage';
import { CategoryCard } from './CategoryCard';

// The listing routes every help centre has (docs/specs/018-help/help-pages.md "Category pages"): a support
// category's page of article cards, and the features index of category cards. The copy (title, lede, the
// description search engines show) is the product's, passed in by its route file.

export interface ListingCopy {
  title: string;
  /** The meta description: what a search result shows. */
  description: string;
  /** The line under the page's title. */
  lede: string;
  eyebrow?: string;
}

/** A support category's metadata, at `/help/<slug>/`. */
export function supportCategoryMetadata(site: HelpSite, slug: string, copy: ListingCopy): Metadata {
  return site.helpMetadata({
    title: copy.title,
    description: copy.description,
    path: `/help/${slug}/`,
  });
}

/** A support category's page: its articles as cards, numbered when it is a walkthrough (Getting Started). */
export function SupportCategoryPage({
  site,
  slug,
  copy,
  numbered = false,
}: {
  site: HelpSite;
  slug: string;
  copy: ListingCopy;
  numbered?: boolean;
}) {
  const articles = site.catalogue.articles.filter((a) => a.categorySlug === slug);
  return (
    <BrowsePage
      site={site}
      listing={{ appPath: `/${slug}/`, articles }}
      title={copy.title}
      eyebrow={copy.eyebrow}
      lede={copy.lede}
    >
      {articles.map((article, index) => (
        <ArticleCard
          key={article.slug}
          site={site}
          article={article}
          number={numbered ? index + 1 : undefined}
        />
      ))}
    </BrowsePage>
  );
}

/** The features index's metadata, at `/help/features/`. */
export function featuresMetadata(site: HelpSite, description: string): Metadata {
  return site.helpMetadata({ title: 'Features', description, path: '/help/features/' });
}

/** The features index: every feature category as a card. */
export function FeaturesPage({
  site,
  lede = 'In-depth guides for everything in the editor, grouped by area.',
}: {
  site: HelpSite;
  lede?: string;
}) {
  return (
    <BrowsePage site={site} title="Features" eyebrow="Editor Guides" lede={lede}>
      {site.catalogue.categories
        .filter((c) => c.kind === 'feature')
        .map((category) => (
          <CategoryCard key={category.slug} site={site} category={category} />
        ))}
    </BrowsePage>
  );
}
