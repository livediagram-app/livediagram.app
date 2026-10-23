import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Privacy and Security',
  description:
    'How your data is handled, what livedesign collects, and how share links are protected.',
  path: '/help/privacy-and-security/',
});

export default function PrivacyAndSecurityPage() {
  const articles = getArticlesByCategory('privacy-and-security');
  return (
    <BrowsePage
      listing={{ appPath: '/privacy-and-security/', articles: articles }}
      title="Privacy and Security"
      lede="How your data is handled and how to keep your designs safe."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
