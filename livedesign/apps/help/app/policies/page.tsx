import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Policies',
  description:
    'How to report a vulnerability. The terms and privacy policy are liveworkspace\'s, on liveworkspace.app.',
  path: '/help/policies/',
});

export default function PoliciesPage() {
  const articles = getArticlesByCategory('policies');
  return (
    <BrowsePage
      listing={{ appPath: '/policies/', articles: articles }}
      title="Policies"
      lede="How to report a security issue privately. The terms and privacy policy for livedesign.app are liveworkspace's, at liveworkspace.app/terms and liveworkspace.app/privacy; a copy you self-host is yours to run."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
