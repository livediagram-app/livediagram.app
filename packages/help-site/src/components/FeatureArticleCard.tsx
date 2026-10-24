import Link from 'next/link';
import { articleHref, type Article } from '@liveworkspace/help-registry';
import { FEATURE_TILE_CLASS, featureTileStyle } from '../lib/feature-tile';
import type { HelpSite } from '../site';
import { CountPill } from './CountPill';

// A feature-guide card: the feature's icon tile + title + description, with a
// "N guides" badge when it has sub-articles. Shared by the home page's Feature
// Guides grid and the /help/features index (identical markup in both before).
export function FeatureArticleCard({ site, article }: { site: HelpSite; article: Article }) {
  const subCount = site.catalogue.articles.filter((a) => a.parentSlug === article.slug).length;
  const colour = site.featureColour(article.slug, article.categorySlug);
  return (
    <Link
      href={articleHref(article)}
      className="card-glow group block rounded-xl bg-white p-5 transition-colors duration-micro hover:bg-brand-50/30 dark:hover:bg-brand-500/10 sm:p-6 dark:bg-slate-900"
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${FEATURE_TILE_CLASS}`}
          style={featureTileStyle(colour)}
        >
          {site.featureIcon(article.slug, article.categorySlug)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {article.title}
          </h3>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {article.description}
          </p>
        </div>
      </div>
      <CountPill count={subCount} noun="guide" />
    </Link>
  );
}
