import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Self-Hosting',
  description: 'livediagram is open source and MIT-licensed. Run your own instance on Cloudflare.',
  path: '/help/self-hosting/',
});

export default function SelfHostingPage() {
  const articles = getArticlesByCategory('self-hosting');
  return (
    <BrowsePage
      title="Self-Hosting"
      lede="The whole product is open source. Here is how to run your own."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
