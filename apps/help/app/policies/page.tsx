import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Policies',
  description:
    'The legal terms for the hosted liveplanner service: the Terms of Service, the full Privacy Policy and how to report a vulnerability.',
  path: '/help/policies/',
});

export default function PoliciesPage() {
  const articles = getArticlesByCategory('policies');
  return (
    <BrowsePage
      listing={{ appPath: '/policies/', articles: articles }}
      title="Policies"
      lede="The terms that govern the hosted service, and how your data is handled."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
