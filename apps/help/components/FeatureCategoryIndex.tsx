import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { FeatureArticleCard } from '@/components/FeatureArticleCard';
import { categories, getCategoryGroups } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

// Shared index page for a feature-guide category (User Interface, Explorer,
// Palette, Canvas, Tabs, Collaboration, Tools, ... — docs/specs/018-help/help-app.md). A card grid of
// the category's feature landings, reusing FeatureArticleCard so each keeps its
// icon, accent colour, and "N guides" badge. Each app/<slug>/page.tsx is a
// thin wrapper around this so the category indexes stay in one place.

function category(slug: string) {
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) throw new Error(`Unknown feature category: ${slug}`);
  return cat;
}

export function featureCategoryMetadata(slug: string): Metadata {
  const cat = category(slug);
  return helpMetadata({ title: cat.title, description: cat.description, path: `/help/${slug}/` });
}

export function FeatureCategoryIndex({ slug }: { slug: string }) {
  const cat = category(slug);
  const groups = getCategoryGroups(slug);
  return (
    <div>
      <Breadcrumb items={[{ label: cat.title }]} />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">{cat.title}</h1>
        <p className="mb-8 text-base leading-relaxed text-slate-500 md:text-lg">
          {cat.description}
        </p>
        {groups.map(({ group, articles }) => (
          <section key={group || 'all'} className="mb-10 last:mb-0">
            {group && (
              <h2 className="mb-4 text-lg font-semibold text-slate-800 md:text-xl">{group}</h2>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <FeatureArticleCard key={article.slug} article={article} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
