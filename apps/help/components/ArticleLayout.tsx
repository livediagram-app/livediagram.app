'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Breadcrumb } from './Breadcrumb';
import { JsonLd } from './JsonLd';
import { SectionedContent } from './SectionedContent';
import { TableOfContents } from './TableOfContents';
import { articleHref, articles, categoryHref, type Article } from '@/lib/articles';
import { articleJsonLd } from '@/lib/structured-data';
import { track } from '@/lib/telemetry';

/** Sidebar card: shows the TOC and/or a "Learn more" list of related
 *  guides. Renders nothing visible if both are empty (CSS hides it). */
function SidebarCard({ subArticles }: { subArticles?: Article[] }) {
  const hasSubArticles = !!subArticles && subArticles.length > 0;

  return (
    <div className="sidebar-card rounded-xl border border-slate-200 bg-white p-5">
      <TableOfContents />
      {hasSubArticles && (
        <>
          <div className="toc-divider my-4 border-t border-slate-200" />
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Learn More
          </h3>
          <p className="mb-3 text-[11px] text-slate-400">Related guides on this topic</p>
          <ul className="space-y-1.5">
            {subArticles!.map((a, i) => (
              <li key={a.slug}>
                <Link
                  href={articleHref(a)}
                  className="flex items-center gap-2.5 py-1 text-sm text-slate-600 transition-colors hover:text-brand-700"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                    {i + 1}
                  </span>
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface ArticleLayoutProps {
  title: string;
  description?: string;
  categoryTitle: string;
  categorySlug: string;
  subArticles?: Article[];
  parentArticle?: { title: string; slug: string };
  children: React.ReactNode;
}

export function ArticleLayout({
  title,
  description,
  categoryTitle,
  categorySlug,
  subArticles,
  parentArticle,
  children,
}: ArticleLayoutProps) {
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [readingTime, setReadingTime] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const text = contentRef.current.textContent ?? '';
      const words = text.split(/\s+/).filter(Boolean).length;
      setReadingTime(Math.max(1, Math.ceil(words / 200)));
    }
  }, []);

  // The current article's slug, taken from the last URL path segment. Used
  // as the telemetry `type` (spec/22): a bounded registry identifier, never
  // the free-text title (which the ingest validator would reject). One
  // Help/View event fires per article view.
  const pathname = usePathname();
  const slug = (pathname ?? '').split('/').filter(Boolean).pop() ?? '';
  useEffect(() => {
    if (slug) track('Help', 'View', slug);
  }, [slug]);

  // Build breadcrumb. Skip the category when it duplicates the title or
  // the parent title.
  const showCategory = categoryTitle !== title && categoryTitle !== parentArticle?.title;
  const parentHref =
    parentArticle && parentArticle.slug !== categorySlug
      ? articleHref({ categorySlug, slug: parentArticle.slug })
      : categoryHref(categorySlug);
  const breadcrumbItems = parentArticle
    ? [
        ...(showCategory ? [{ label: categoryTitle, href: categoryHref(categorySlug) }] : []),
        { label: parentArticle.title, href: parentHref },
        { label: title },
      ]
    : showCategory
      ? [{ label: categoryTitle, href: categoryHref(categorySlug) }, { label: title }]
      : [{ label: title }];

  // Article structured data (spec/55). The Breadcrumb component already emits
  // the BreadcrumbList, so this only adds the TechArticle node. Resolve this
  // page's own URL from the registry ((categorySlug, title) is unique) so the
  // node ships on every guide without each page.mdx passing its slug.
  const entry = articles.find((a) => a.categorySlug === categorySlug && a.title === title);
  const selfHref = entry ? articleHref(entry) : categoryHref(categorySlug);

  return (
    <div>
      <JsonLd data={articleJsonLd({ title, description: description ?? '', appPath: selfHref })} />
      <Breadcrumb items={breadcrumbItems} />

      <section className="relative border-b border-slate-200 bg-brand-50/40 py-12 md:py-16">
        <div className="relative mx-auto max-w-7xl px-4 md:px-8">
          <h1 className="mb-3 text-3xl font-bold text-slate-900 md:text-4xl">{title}</h1>
          {description && (
            <p className="mb-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              {description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            {readingTime > 0 && (
              <span className="flex items-center gap-1.5">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6l4 2"
                  />
                </svg>
                {readingTime} min read
              </span>
            )}
          </div>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 lg:hidden"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
            Contents and guides
          </button>
        </div>
      </section>

      {/* Mobile sidebar drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="absolute bottom-0 right-0 top-0 w-80 max-w-[85vw] overflow-y-auto bg-slate-50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Article Navigation</h2>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 text-slate-500 transition-colors hover:text-slate-900"
                aria-label="Close navigation"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <SidebarCard subArticles={subArticles} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-8 pt-8 md:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <article className="min-w-0 flex-1">
            <div ref={contentRef}>
              <SectionedContent>{children}</SectionedContent>
            </div>

            <div className="mt-12 border-t border-slate-200 pt-6">
              <p className="mb-3 text-sm text-slate-600">Was this article helpful?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (feedback !== 'yes' && slug) track('Help', 'Helpful', slug);
                    setFeedback('yes');
                  }}
                  className={`cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    feedback === 'yes'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  Yes, it helped
                </button>
                <button
                  onClick={() => {
                    if (feedback !== 'no' && slug) track('Help', 'Unhelpful', slug);
                    setFeedback('no');
                  }}
                  className={`cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    feedback === 'no'
                      ? 'bg-rose-600 text-white'
                      : 'border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  Not really
                </button>
              </div>
              {feedback && (
                <p className="mt-3 text-sm text-slate-500">
                  Thanks for your feedback.{' '}
                  <a
                    href="/help/contact/"
                    className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                  >
                    Need more help?
                  </a>
                </p>
              )}
            </div>
          </article>

          <aside className="hidden shrink-0 lg:block lg:w-80">
            <div className="sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto rounded-xl">
              <SidebarCard subArticles={subArticles} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
