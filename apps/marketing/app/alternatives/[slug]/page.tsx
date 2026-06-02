import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ALTERNATIVE_SLUGS, getAlternative } from '@/lib/alternatives';
import { subpageMetadata } from '@/lib/subpage-metadata';

// One page per competitor at /alternatives/<slug> (see
// specs/21-comparison-pages.md). Static export: only the known slugs are
// generated, so an unknown slug 404s at build rather than rendering.
export const dynamicParams = false;

export function generateStaticParams() {
  return ALTERNATIVE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const alt = getAlternative(slug);
  if (!alt) return {};
  return subpageMetadata({
    title: alt.title,
    description: alt.description,
    path: `/alternatives/${slug}`,
  });
}

export default async function AlternativePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const alt = getAlternative(slug);
  if (!alt) notFound();

  return (
    <>
      <BreadcrumbJsonLd
        trail={[
          { name: 'Alternatives', path: '/alternatives' },
          { name: `${alt.name} alternative`, path: `/alternatives/${slug}` },
        ]}
      />
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          livediagram vs {alt.name}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {alt.h1}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">{alt.lede}</p>

        {/* At-a-glance comparison */}
        <div className="mt-10 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4 font-medium text-slate-400" />
                <th className="rounded-t-md bg-brand-50 px-4 py-2 font-semibold text-brand-700">
                  livediagram
                </th>
                <th className="px-4 py-2 font-semibold text-slate-700">{alt.name}</th>
              </tr>
            </thead>
            <tbody>
              {alt.rows.map((row) => (
                <tr key={row.label} className="border-b border-slate-100 align-top">
                  <th
                    scope="row"
                    className="py-3 pr-4 font-medium text-slate-500"
                    style={{ fontWeight: 500 }}
                  >
                    {row.label}
                  </th>
                  <td className="bg-brand-50/60 px-4 py-3 text-slate-800">{row.us}</td>
                  <td className="px-4 py-3 text-slate-600">{row.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Honest two-sided takeaway */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-6">
            <h2 className="text-base font-semibold text-slate-900">Why pick livediagram</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
              {alt.usBest.map((point) => (
                <li key={point} className="flex gap-2">
                  <span aria-hidden className="mt-0.5 text-brand-600">
                    ✓
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Where {alt.name} is the better pick
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
              {alt.themBest.map((point) => (
                <li key={point} className="flex gap-2">
                  <span aria-hidden className="mt-0.5 text-slate-400">
                    •
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Comparisons reflect each product&rsquo;s general positioning and may change. Check{' '}
          {alt.name}&rsquo;s own site for current details.
        </p>

        {/* CTA */}
        <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-700">See how it feels, no sign-up required.</p>
          <a
            href="/live/new"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Start drawing
          </a>
        </div>

        <p className="mt-10 text-sm text-slate-500">
          <a href="/alternatives" className="text-brand-600 hover:underline">
            ← Compare livediagram to other tools
          </a>
        </p>
      </main>
      <Footer />
    </>
  );
}
