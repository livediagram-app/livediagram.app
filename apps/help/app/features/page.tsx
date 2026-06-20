import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { CategoryCard } from '@/components/CategoryCard';
import { featureCategories } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Features',
  description:
    'Browse livediagram feature guides by area: Explorer, Palette, Canvas, Tabs, Customisation, Collaboration, and Tools.',
  path: '/help/features/',
});

export default function FeaturesPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Features' }]} />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">Features</h1>
        <p className="mb-8 text-base leading-relaxed text-slate-500 md:text-lg">
          In-depth guides for everything in the editor, grouped by area.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featureCategories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </div>
    </div>
  );
}
