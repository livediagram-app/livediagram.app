import Link from 'next/link';
import {
  APP_ORDER,
  categoryHref,
  type Category,
  type HelpScope,
} from '@liveworkspace/help-registry';
import type { HelpSite } from '../site';
import { AppMarkRow, rowOrder } from './AppMarks';
import { ArrowRightIcon } from './chrome-icons';

/** The most marks a card's corner row draws before it counts the rest ("+2"). */
const CARD_MARKS_MAX = 3;

/** The words beside a card's corner row: "All apps" for every app, "+N" past the marks drawn, else "N apps". */
export function cardAppsLabel(apps: readonly unknown[]): string {
  if (apps.length >= APP_ORDER.length) return 'All apps';
  if (apps.length > CARD_MARKS_MAX) return `+${apps.length - CARD_MARKS_MAX}`;
  return `${apps.length} apps`;
}

/** A category card's corner row (liveworkspace/docs/specs/017-help/help-centre.md "The logos"): the apps whose
 *  articles the category holds, small, the current app first and ringed, when it holds shared ones. */
export function CardApps({
  category,
  scope,
}: {
  category: Category;
  scope: HelpScope | undefined;
}) {
  const apps = category.apps ?? [];
  if (!scope || apps.length < 2) return null;
  const shown = rowOrder(apps, scope).slice(0, CARD_MARKS_MAX);
  return (
    <span
      data-card-apps=""
      className="optical-edges absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300"
    >
      <AppMarkRow apps={shown} scope={scope} size={12} />
      <span className="text-optical-line">{cardAppsLabel(apps)}</span>
    </span>
  );
}

/** "12 guides", or nothing for a category with none. */
export function guideCount(n: number): string {
  return n > 0 ? `${n} ${n === 1 ? 'guide' : 'guides'}` : '';
}

/** The category's scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"), or nothing for a slug without one. */
export function CategoryArt({ site, slug }: { site: HelpSite; slug: string }) {
  const Scene = site.art.categoryArt[slug];
  return Scene ? <Scene /> : null;
}

// A category's card (liveworkspace/docs/specs/017-help/help-centre.md "Category art"): its scene across the top, then its title,
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
        className={`relative aspect-[400/220] shrink-0 overflow-hidden border-slate-100 dark:border-slate-800 ${
          wide ? 'border-b sm:aspect-auto sm:w-1/2 sm:border-b-0 sm:border-r' : 'border-b'
        }`}
      >
        <CategoryArt site={site} slug={category.slug} />
        <CardApps category={category} scope={site.scope} />
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
