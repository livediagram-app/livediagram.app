import type { Metadata } from 'next';
import { BrowsePage } from '@/components/BrowsePage';
import { CategoryCard } from '@/components/CategoryCard';
import { featureCategories } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Features',
  description:
    'Browse livediagram feature guides by area: User Interface, Explorer, Palette, Canvas, Tabs, Collaboration, and Tools.',
  path: '/help/features/',
});

export default function FeaturesPage() {
  return (
    <BrowsePage
      title="Features"
      lede="In-depth guides for everything in the editor, grouped by area."
    >
      {featureCategories.map((category) => (
        <CategoryCard key={category.slug} category={category} />
      ))}
    </BrowsePage>
  );
}
