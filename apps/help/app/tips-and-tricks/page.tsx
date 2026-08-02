import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Tips and Tricks',
  description: 'Shortcuts and lesser-known features that make editing in livediagram faster.',
  path: '/help/tips-and-tricks/',
});

export default function TipsAndTricksPage() {
  const articles = getArticlesByCategory('tips-and-tricks');
  return (
    <BrowsePage
      title="Tips and Tricks"
      lede="Work faster with these shortcuts and hidden features."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
