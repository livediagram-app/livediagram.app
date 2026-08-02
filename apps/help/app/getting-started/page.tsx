import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Getting Started',
  description:
    'New to livediagram? Create your first diagram, learn the canvas, and share it with your team.',
  path: '/help/getting-started/',
});

export default function GettingStartedPage() {
  const articles = getArticlesByCategory('getting-started');
  return (
    <BrowsePage
      title="Getting Started"
      lede="New here? These guides get you up and running quickly."
    >
      {articles.map((article, index) => (
        <ArticleCard key={article.slug} article={article} number={index + 1} />
      ))}
    </BrowsePage>
  );
}
