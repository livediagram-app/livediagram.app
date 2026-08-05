import Link from 'next/link';
import { articleHref, articles, type Article } from '@/lib/articles';
import { featureColour } from '@/lib/featureColours';
import { featureIcon } from '@/lib/featureIcons';
import { CountPill } from '@/components/CountPill';

// A feature-guide card: the feature's icon tile + title + description, with a
// "N guides" badge when it has sub-articles. Shared by the home page's Feature
// Guides grid and the /help/features index (identical markup in both before).
export function FeatureArticleCard({ article }: { article: Article }) {
  const subCount = articles.filter((a) => a.parentSlug === article.slug).length;
  const colour = featureColour(article.slug, article.categorySlug);
  return (
    <Link
      href={articleHref(article)}
      className="card-glow group block rounded-xl bg-white p-5 transition-colors duration-300 hover:bg-brand-50/30 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${colour}1f`, color: colour }}
        >
          {featureIcon(article.slug, article.categorySlug)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 text-lg font-semibold text-slate-900">{article.title}</h3>
          <p className="text-sm leading-relaxed text-slate-500">{article.description}</p>
        </div>
      </div>
      <CountPill count={subCount} noun="guide" />
    </Link>
  );
}
