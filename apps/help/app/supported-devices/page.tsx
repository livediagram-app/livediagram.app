import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
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
    <div>
      <Breadcrumb items={[{ label: 'Supported Devices' }]} />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">Supported Devices</h1>
        <p className="mb-8 text-base leading-relaxed text-slate-500 md:text-lg">
          livediagram runs in the browser on any device. Pick yours to see what works and what to
          expect.
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
