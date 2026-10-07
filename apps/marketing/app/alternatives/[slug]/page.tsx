import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { AlternativeCard } from '@/components/compare/AlternativeCard';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import { COMPETITOR_LOOK } from '@/components/compare/competitor-look';
import { VsBadge } from '@/components/compare/VsBadge';
import { FaqItem } from '@/components/faq/FaqItem';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { PageHero } from '@/components/PageHero';
import { TryItCard } from '@/components/TryItCard';
import {
  ALTERNATIVE_SLUGS,
  ALTERNATIVES,
  ALTERNATIVES_LAST_UPDATED,
  getAlternative,
} from '@/lib/alternatives';
import { lucideCheck, lucideCircleDot } from '@livediagram/icons/lucide';
import { BrandMark, JsonLd, lucideGlyph, pageMetadata } from '@livediagram/ui';

const H2 = 'text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100';
const CheckIcon = lucideGlyph(lucideCheck, 16);
const DotIcon = lucideGlyph(lucideCircleDot, 16);
const sectionId = (i: number) => `section-${i + 1}`;

// One page per competitor at /alternatives/<slug> (see
// docs/specs/019-marketing/comparison-pages.md). Static export: only the known slugs are
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
  return pageMetadata({
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

  // FAQPage JSON-LD (docs/specs/019-marketing/comparison-pages.md "Metadata"): the per-competitor questions
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

  const toc = [
    { id: 'at-a-glance', label: 'At a glance' },
    { id: 'which-to-pick', label: 'Which to pick' },
    ...alt.sections.map((section, i) => ({ id: sectionId(i), label: section.heading })),
    { id: 'faq', label: 'FAQ' },
  ];
  const look = COMPETITOR_LOOK[alt.slug];
  const CompetitorIcon = look?.icon;
  const others = ALTERNATIVES.filter((other) => other.slug !== alt.slug).slice(0, 3);

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        trail={[
          { name: 'Product Comparison', path: '/alternatives' },
          { name: `${alt.name} alternative`, path: `/alternatives/${slug}` },
        ]}
      />
      <Header surface="Compare" />
      <Breadcrumb
        items={[
          { label: 'Product Comparison', href: '/alternatives' },
          { label: `${alt.name} alternative` },
        ]}
      />
      <main className="pb-20 sm:pb-24">
        <PageHero eyebrow={`livediagram vs ${alt.name}`} title={alt.h1} lede={alt.lede}>
          <div className="mt-8 flex justify-center">
            <VsBadge slug={alt.slug} />
          </div>
        </PageHero>

        <div className="mx-auto mt-14 grid max-w-6xl gap-10 px-6 lg:grid-cols-[14rem_1fr] lg:gap-14">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="px-3 text-xs font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
                On this page
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {toc.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      className="block rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    >
                      {entry.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="min-w-0 space-y-16">
            <section id="at-a-glance" aria-labelledby="at-a-glance-title" className="scroll-mt-24">
              <h2 id="at-a-glance-title" className={H2}>
                At a glance
              </h2>
              <div className="mt-6">
                <ComparisonTable alt={alt} />
              </div>
            </section>

            {/* Honest two-sided takeaway (docs/specs/019-marketing/comparison-pages.md "Honesty rules"). */}
            <section
              id="which-to-pick"
              aria-labelledby="which-to-pick-title"
              className="scroll-mt-24"
            >
              <h2 id="which-to-pick-title" className={H2}>
                Which to pick
              </h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-6 dark:border-brand-500/30 dark:bg-brand-500/10">
                  <h3 className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500 text-white dark:bg-brand-600">
                      <BrandMark className="size-5" />
                    </span>
                    Why pick livediagram
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {alt.usBest.map((point) => (
                      <li key={point} className="flex gap-2.5">
                        <span className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300">
                          <CheckIcon />
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    <span
                      className={`flex size-8 items-center justify-center rounded-lg bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 ${look?.glyph ?? 'text-slate-500'}`}
                    >
                      {CompetitorIcon && <CompetitorIcon size={18} />}
                    </span>
                    Where {alt.name} is the better pick
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {alt.themBest.map((point) => (
                      <li key={point} className="flex gap-2.5">
                        <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">
                          <DotIcon />
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Deep-dive sections (docs/specs/019-marketing/comparison-pages.md "Page shape"): competitor-specific
                prose expanding the key value themes behind the bullets above. */}
            {alt.sections.map((section, i) => (
              <section
                key={section.heading}
                id={sectionId(i)}
                aria-labelledby={`${sectionId(i)}-title`}
                className="scroll-mt-24"
              >
                <h2 id={`${sectionId(i)}-title`} className={H2}>
                  {section.heading}
                </h2>
                <div className="mt-4 max-w-3xl space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="leading-relaxed text-slate-600 dark:text-slate-300"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            {/* Per-competitor FAQ, mirrored into the FAQPage JSON-LD above. */}
            <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24">
              <h2 id="faq-title" className={H2}>
                {alt.name} alternative FAQ
              </h2>
              <div className="mt-6 space-y-3">
                {alt.faqs.map((faq) => (
                  <FaqItem key={faq.q} q={faq.q}>
                    {faq.a}
                  </FaqItem>
                ))}
              </div>
            </section>

            <TryItCard
              title="See how it feels"
              body="No sign-up, nothing to install, free forever. Open a canvas and judge for yourself."
              source="Compare.Card"
            />

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparisons reflect each product&rsquo;s general positioning and may change. Check{' '}
              {alt.name}&rsquo;s own site for current details. Last reviewed{' '}
              {ALTERNATIVES_LAST_UPDATED.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
              .
            </p>
          </div>
        </div>

        <section aria-labelledby="others-title" className="mx-auto mt-20 max-w-6xl px-6">
          <h2 id="others-title" className={`${H2} text-center`}>
            Other comparisons
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((other) => (
              <AlternativeCard key={other.slug} alt={other} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
