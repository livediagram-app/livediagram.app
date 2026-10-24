import Link from 'next/link';
import { categoryHref, type Category } from '@liveworkspace/help-registry';
import type { HelpSite } from '../site';
import { ArrowRightIcon } from './chrome-icons';

/** "12 guides", or nothing for a category with none. */
export function guideCount(n: number): string {
  return n > 0 ? `${n} ${n === 1 ? 'guide' : 'guides'}` : '';
}

/** The category's scene (docs/specs/018-help/help-pages.md "Category art"), or nothing for a slug without one. */
export function CategoryArt({ site, slug }: { site: HelpSite; slug: string }) {
  const Scene = site.art.categoryArt[slug];
  return Scene ? <Scene /> : null;
}

// A category's card (docs/specs/018-help/help-pages.md "Category art"): its scene across the top, then its title,
// its description and how many guides it holds. `wide` lays the scene beside the copy instead, for a section
// with only two cards, where a stacked card would run a full screen tall.
export function CategoryCard({
  site,
  category,
  wide = false,
}: {
  site: HelpSite;
  category: Category;
  wide?: boolean;
}) {
  const count = guideCount(category.articleCount);
  return (
    <Link
      href={categoryHref(category.slug)}
      className={`card-glow group flex overflow-hidden rounded-2xl bg-white dark:bg-slate-900 ${
        wide ? 'flex-col sm:flex-row' : 'flex-col'
      }`}
    >
      <div
        aria-hidden
        className={`aspect-[400/220] shrink-0 overflow-hidden border-slate-100 dark:border-slate-800 ${
          wide ? 'border-b sm:aspect-auto sm:w-1/2 sm:border-b-0 sm:border-r' : 'border-b'
        }`}
      >
        <CategoryArt site={site} slug={category.slug} />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-200">
          {category.title}
        </h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {category.description}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-300">
          {count ? `Browse ${count}` : 'Open'}
          <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
