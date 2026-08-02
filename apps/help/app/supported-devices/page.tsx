import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Supported Devices',
  description:
    'How livediagram works on a computer, a tablet, and a phone, and what to expect on each.',
  path: '/help/supported-devices/',
});

export default function SupportedDevicesPage() {
  const articles = getArticlesByCategory('supported-devices');
  return (
    <BrowsePage
      title="Supported Devices"
      lede="livediagram runs in the browser on any device. Pick yours to see what works and what to expect."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
