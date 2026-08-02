import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Troubleshooting',
  description:
    'Solutions to common problems with the livediagram editor and real-time collaboration.',
  path: '/help/troubleshooting/',
});

export default function TroubleshootingPage() {
  const articles = getArticlesByCategory('troubleshooting');
  return (
    <BrowsePage title="Troubleshooting" lede="Something not working? Start here.">
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
