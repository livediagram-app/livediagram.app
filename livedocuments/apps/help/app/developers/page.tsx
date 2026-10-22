import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Developers',
  description:
    'Call the livedocuments REST API from scripts or the command line: authentication, worked examples, the CLI, errors and limits, and the OpenAPI reference.',
  path: '/help/developers/',
});

export default function DevelopersPage() {
  const articles = getArticlesByCategory('developers');
  return (
    <BrowsePage
      listing={{ appPath: '/developers/', articles: articles }}
      title="Developers"
      lede="Drive livedocuments from your own scripts and integrations. The same REST API the editor uses, callable with an API token, or from a terminal with the livedocuments CLI."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
