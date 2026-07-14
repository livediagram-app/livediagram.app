import { CtaLink } from '@/components/CtaLink';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { JsonLd } from '@/components/JsonLd';
import { ALTERNATIVE_SLUGS, ALTERNATIVES_LAST_UPDATED, getAlternative } from '@/lib/alternatives';
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
    modifiedTime: ALTERNATIVES_LAST_UPDATED,
  });
}

export default async function AlternativePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const alt = getAlternative(slug);
  if (!alt) notFound();

  // FAQPage JSON-LD (spec/21 "Metadata"): the per-competitor questions
  // target the long-tail queries around "<tool> alternative" searches
  // and can surface as Google's expandable-FAQ rich result. Answers
  // are plain strings in the data, so the structured-data text matches
  // the on-page answer verbatim. Same pattern as /faq.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: alt.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={faqJsonLd} />
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

        {/* At-a-glance comparison. Caption is sr-only so the visible
            layout doesn't gain an extra heading row, but screen readers
            and search-engine table-extraction get a self-describing
            summary of the comparison. `scope="col"` on the product
            headers + `scope="row"` on each label cell makes the cell
            relationships explicit for assistive tech. */}
        <div className="mt-10 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              livediagram vs {alt.name}: feature-by-feature comparison
            </caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4 font-medium text-slate-400" scope="col">
                  <span className="sr-only">Feature</span>
                </th>
                <th
                  className="rounded-t-md bg-brand-50 px-4 py-2 font-semibold text-brand-700"
                  scope="col"
                >
                  livediagram
                </th>
                <th className="px-4 py-2 font-semibold text-slate-700" scope="col">
                  {alt.name}
                </th>
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

        {/* Deep-dive sections (spec/21 "Page shape"): competitor-specific
            prose expanding the key value themes behind the bullets above.
            Pure data-driven render; the honesty rules live in the copy
            itself in lib/alternatives.ts. */}
        {alt.sections.map((section) => (
          <section key={section.heading} className="mt-12">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-4 leading-relaxed text-slate-600">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        {/* Per-competitor FAQ, mirrored into the FAQPage JSON-LD above. */}
        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {alt.name} alternative FAQ
          </h2>
          <div className="mt-6 space-y-6">
            {alt.faqs.map((faq) => (
              <div key={faq.q}>
                <h3 className="font-semibold text-slate-900">{faq.q}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-10 text-xs text-slate-400">
          Comparisons reflect each product&rsquo;s general positioning and may change. Check{' '}
          {alt.name}&rsquo;s own site for current details.
        </p>

        {/* CTA */}
        <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-700">See how it feels, no sign-up required.</p>
          <CtaLink href="/new" size="sm" className="mt-3">
            Start drawing
          </CtaLink>
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
