import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Account and Data',
  description: 'Guest access, signing in, syncing, exporting, and deleting your data.',
  path: '/help/account-and-data/',
});

export default function AccountAndDataPage() {
  const articles = getArticlesByCategory('account-and-data');
  return (
    <BrowsePage
      title="Account and Data"
      lede="How identity works, what an account adds, and how to manage your data."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
