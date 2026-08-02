import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Policies',
  description:
    'The legal terms for the hosted livediagram service: the Terms of Service and the full Privacy Policy.',
  path: '/help/policies/',
});

export default function PoliciesPage() {
  const articles = getArticlesByCategory('policies');
  return (
    <BrowsePage
      title="Policies"
      lede="The terms that govern the hosted service, and how your data is handled. They cover only livediagram.app; a copy you self-host is yours to run."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
