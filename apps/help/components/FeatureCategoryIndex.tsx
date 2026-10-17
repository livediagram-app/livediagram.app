import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { FeatureArticleCard } from '@/components/FeatureArticleCard';
import { HelpHero } from '@/components/HelpHero';
import { CategoryArt } from '@/components/category-art';
import { guideCount } from '@/components/CategoryCard';
import { articleHref, categories, categoryHref, getCategoryGroups } from '@/lib/articles';
import { collectionJsonLd } from '@/lib/structured-data';
import { JsonLd } from '@livediagram/ui';
import { helpMetadata } from '@/lib/seo';

// Shared index page for a feature-guide category (User Interface, Explorer, Palette, Canvas, Tabs, Collaboration,
// Tools, ...: docs/specs/018-help/help-pages.md "Category pages"). The category's header with its scene, then its
// feature landings as cards, in named groups when the category has them, with a jump list beside the groups on a
// wide screen. Each app/<slug>/page.tsx is a thin wrapper around this so the category indexes stay in one place.

function category(slug: string) {
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) throw new Error(`Unknown feature category: ${slug}`);
  return cat;
}

/** A group's anchor id on its category page. */
function groupAnchor(group: string): string {
  return group
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function featureCategoryMetadata(slug: string): Metadata {
  const cat = category(slug);
  return helpMetadata({ title: cat.title, description: cat.description, path: `/help/${slug}/` });
}

export function FeatureCategoryIndex({ slug }: { slug: string }) {
  const cat = category(slug);
  const groups = getCategoryGroups(slug);
  const grouped = groups.length > 1;
  return (
    <div>
      <JsonLd
        data={collectionJsonLd({
          title: cat.title,
          description: cat.description,
          appPath: categoryHref(slug),
          items: groups.flatMap(({ articles }) =>
            articles.map((a) => ({ name: a.title, appPath: articleHref(a) })),
          ),
        })}
      />
      <Breadcrumb items={[{ label: cat.title }]} />
      <HelpHero
        eyebrow="Editor Guide"
        title={cat.title}
        lede={cat.description}
        art={<CategoryArt slug={slug} />}
      >
        <p className="mt-5 text-sm font-medium text-(--hero-muted)">
          {guideCount(cat.articleCount)}
          {grouped && ` in ${groups.length} sections`}
        </p>
      </HelpHero>
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <div className={grouped ? 'lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10' : ''}>
          {grouped && (
            <nav aria-label={`${cat.title} sections`} className="hidden lg:block">
              <div className="sticky top-32">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  On this page
                </p>
                <ul className="space-y-1 border-l border-slate-200 dark:border-slate-800">
                  {groups.map(({ group, articles }) => (
                    <li key={group}>
                      <a
                        href={`#${groupAnchor(group)}`}
                        className="-ml-px flex items-center justify-between border-l-2 border-transparent py-1.5 pl-4 pr-1 text-sm text-slate-600 transition-colors hover:border-brand-500 hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-200"
                      >
                        {group}
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {articles.length}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          )}
          <div>
            {groups.map(({ group, articles }) => (
              <section
                key={group || 'all'}
                id={group ? groupAnchor(group) : undefined}
                className="mb-12 scroll-mt-32 last:mb-0"
              >
                {group ? (
                  <h2 className="mb-4 flex items-baseline gap-3 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    {group}
                    <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                      {articles.length}
                    </span>
                  </h2>
                ) : (
                  // The cards title themselves with h3, so an ungrouped grid still gets an h2 above them.
                  <h2 className="sr-only">Guides</h2>
                )}
                <div
                  className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${grouped ? 'xl:grid-cols-3' : 'lg:grid-cols-3'}`}
                >
                  {articles.map((article) => (
                    <FeatureArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
