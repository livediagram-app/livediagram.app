import Link from 'next/link';
import { categoryHref, type Category } from '@/lib/articles';
import { CategoryIllustration } from '@/components/CategoryIllustration';
import { CountPill } from '@/components/CountPill';

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={categoryHref(category.slug)}
      className="card-glow group block overflow-hidden rounded-xl bg-white transition-colors duration-300 hover:bg-brand-50/30"
    >
      {/* On-brand banner illustration evoking this area of the app (spec/55). */}
      <div className="h-16 w-full overflow-hidden border-b border-slate-100 bg-gradient-to-b from-brand-100 to-brand-50">
        <CategoryIllustration slug={category.slug} />
      </div>
      <div className="p-5 sm:p-6">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">{category.title}</h3>
        <p className="text-sm leading-relaxed text-slate-500">{category.description}</p>
        <CountPill count={category.articleCount} noun="article" />
      </div>
    </Link>
  );
}
