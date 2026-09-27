import Link from 'next/link';
import { categoryHref, type Category } from '@/lib/articles';
import { CategoryIllustration } from '@/components/CategoryIllustration';
import { CountPill } from '@/components/CountPill';

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={categoryHref(category.slug)}
      className="card-glow group block overflow-hidden rounded-xl bg-white transition-colors duration-micro hover:bg-brand-50/30 dark:hover:bg-brand-500/10 dark:bg-slate-900"
    >
      {/* On-brand banner illustration evoking this area of the app (docs/specs/018-help/help-app.md). */}
      <div className="h-16 w-full overflow-hidden border-b border-slate-100 bg-gradient-to-b from-brand-100 to-brand-50 dark:border-slate-800 dark:from-brand-500/15 dark:to-brand-500/5">
        <CategoryIllustration slug={category.slug} />
      </div>
      <div className="p-5 sm:p-6">
        <h3 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {category.title}
        </h3>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {category.description}
        </p>
        <CountPill count={category.articleCount} noun="article" />
      </div>
    </Link>
  );
}
