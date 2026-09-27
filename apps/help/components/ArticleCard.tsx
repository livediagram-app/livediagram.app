import Link from 'next/link';
import { articleHref, type Article } from '@/lib/articles';
import { FEATURE_ICONS } from '@/lib/featureIcons';
import { SUPPORT_ARTICLE_ICONS, SUPPORT_ARTICLE_FALLBACK } from '@/lib/articleIcons';
import { ArrowRightIcon } from '@/lib/chrome-icons';
import { GlyphDisc } from '@livediagram/ui';

export function ArticleCard({ article, number }: { article: Article; number?: number }) {
  // A numbered card (e.g. Getting Started) leads with its step badge; every
  // other support-article card leads with a brand-toned topic icon so no card
  // is a bare title. Bespoke support icon first, then any feature-icon that
  // shares the slug, then a generic document glyph.
  const icon =
    number === undefined
      ? (SUPPORT_ARTICLE_ICONS[article.slug] ??
        FEATURE_ICONS[article.slug] ??
        SUPPORT_ARTICLE_FALLBACK)
      : null;
  return (
    <Link
      href={articleHref(article)}
      className="card-glow group block rounded-xl bg-white p-5 transition-colors duration-micro hover:bg-brand-50/30 dark:hover:bg-brand-500/10 sm:p-6 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        {number !== undefined ? (
          <GlyphDisc
            size={28}
            aria-hidden
            className="bg-brand-600 text-sm font-semibold text-white transition-colors group-hover:bg-brand-700"
          >
            {number}
          </GlyphDisc>
        ) : (
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100 dark:bg-brand-500/15 dark:group-hover:bg-brand-500/25 dark:text-brand-300"
          >
            {icon}
          </span>
        )}
        <h3 className="mt-1 font-semibold text-slate-900 transition-colors group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-200">
          {article.title}
        </h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {article.description}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 transition-all group-hover:gap-2 dark:text-brand-300">
        Read article
        <ArrowRightIcon />
      </span>
    </Link>
  );
}
