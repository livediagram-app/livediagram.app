import type { Metadata } from 'next';
import { SearchInput } from '@/components/SearchInput';
import { CategoryCard } from '@/components/CategoryCard';
import { Breadcrumb } from '@/components/Breadcrumb';
import { featureCategories, supportCategories } from '@/lib/articles';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Help',
  description:
    'Guides, tutorials, and answers for livediagram. Browse feature documentation, getting-started guides, and troubleshooting.',
  path: '/help/',
});

export default function HelpHome() {
  return (
    <div>
      <Breadcrumb items={[]} />
      <section className="relative py-16 text-center md:py-24">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-100/60 via-brand-50/30 to-transparent" />
        <div className="relative mx-auto max-w-2xl px-4">
          <h1 className="mb-4 text-4xl font-bold text-slate-900 md:text-5xl">
            How can{' '}
            <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
              we help
            </span>
            ?
          </h1>
          <p className="mb-8 text-base leading-relaxed text-slate-600 md:text-lg">
            Search our guides and tutorials, or browse by category below.
          </p>
          <SearchInput large />
          <a
            href="/help/contact/"
            className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <rect
                width="20"
                height="16"
                x="2"
                y="4"
                rx="2"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Can&apos;t find what you need? Contact us
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8">
        <div className="mb-10 border-t border-slate-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {supportCategories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
        <div className="mb-10 border-t border-slate-200" />
        <h2 className="mb-2 text-2xl font-bold text-slate-900 md:text-3xl">Features</h2>
        <p className="mb-8 text-base leading-relaxed text-slate-500 md:text-lg">
          In-depth guides for everything in the editor, grouped by area.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCategories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </section>
    </div>
  );
}
