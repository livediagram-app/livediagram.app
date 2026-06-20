import Link from 'next/link';
import { categoryHref, type Category } from '@/lib/articles';
import { CategoryIllustration } from '@/components/CategoryIllustration';

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
        {category.articleCount > 0 && (
          <div className="mt-4 flex justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {category.articleCount} article{category.articleCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
