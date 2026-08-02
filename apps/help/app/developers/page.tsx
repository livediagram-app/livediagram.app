import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Developers',
  description:
    'Call the livediagram REST API from your own scripts: authentication, worked examples, errors and limits, and the OpenAPI reference.',
  path: '/help/developers/',
});

export default function DevelopersPage() {
  const articles = getArticlesByCategory('developers');
  return (
    <BrowsePage
      title="Developers"
      lede="Drive livediagram from your own scripts and integrations. The same REST API the editor uses, callable with an API token."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
