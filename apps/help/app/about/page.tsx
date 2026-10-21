import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { ArticleCard } from '@/components/ArticleCard';
import { getArticlesByCategory } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'About liveplanner',
  description: 'What liveplanner is, who it is for, and why it exists.',
  path: '/help/about/',
});

export default function AboutPage() {
  const articles = getArticlesByCategory('about');
  return (
    <BrowsePage
      listing={{ appPath: '/about/', articles: articles }}
      title="About liveplanner"
      lede="What liveplanner is, who it is for, and why it exists."
    >
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </BrowsePage>
  );
}
