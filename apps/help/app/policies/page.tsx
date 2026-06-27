import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
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
    <div>
      <Breadcrumb items={[{ label: 'Policies' }]} />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">Policies</h1>
        <p className="mb-8 text-base leading-relaxed text-slate-500 md:text-lg">
          The terms that govern the hosted service, and how your data is handled. They cover only
          livediagram.app; a copy you self-host is yours to run.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}
