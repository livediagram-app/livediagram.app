import { lucideCheck, lucideCircleDot } from '@livediagram/icons/lucide';
import { JsonLd, lucideGlyph } from '@livediagram/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlternativeCard } from '@/components/compare/AlternativeCard';
import {
  Breadcrumb,
  BreadcrumbJsonLd,
  compareMetadata,
  PageHero,
} from '@/components/compare/compare-chrome';
import { compareVoice, voiceStyle } from '@/components/compare/compare-theme';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import { FaqItem } from '@/components/compare/FaqItem';
import { TryItCard } from '@/components/compare/TryItCard';
import { VsBadge } from '@/components/compare/VsBadge';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AppMark } from '@/components/landing/AppLogo';
import { ALTERNATIVE_SLUGS, ALTERNATIVES, getAlternative } from '@/lib/alternatives';
import { COMPETITOR_LOOK } from '@/lib/alternatives/competitor-look';

const H2 = 'text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100';
const CheckIcon = lucideGlyph(lucideCheck, 16);
const DotIcon = lucideGlyph(lucideCircleDot, 16);
const sectionId = (i: number) => `section-${i + 1}`;

// One page per competitor at /alternatives/<slug> (liveworkspace/docs/comparison-pages.md "Page
// shape"), in the colours of the app it speaks for, or liveworkspace's for a suite comparison.
// Static export: only the known slugs are generated, so an unknown slug 404s at build rather than
// rendering.
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
  return compareMetadata({
    title: alt.title,
    description: alt.description,
    path: `/alternatives/${slug}`,
    modified: alt.updated,
  });
}

export default async function AlternativePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const alt = getAlternative(slug);
  if (!alt) notFound();

  const voice = compareVoice(alt.apps);
  // FAQPage JSON-LD: the per-competitor questions target the long-tail queries around "<tool>
  // alternative" searches. Answers are plain strings in the data, so the structured-data text
  // matches the on-page answer verbatim.
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
  // Other comparisons from the same apps first, then the rest, so a reader moves across the set.
  const others = [
    ...ALTERNATIVES.filter((o) => o.slug !== alt.slug && o.apps.some((a) => alt.apps.includes(a))),
    ...ALTERNATIVES.filter((o) => !o.apps.some((a) => alt.apps.includes(a))),
  ].slice(0, 3);

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        trail={[
          { name: 'Product Comparison', path: '/alternatives' },
          { name: `${alt.name} alternative`, path: `/alternatives/${slug}` },
        ]}
      />
      <Header />
      <Breadcrumb
        items={[
          { label: 'Product Comparison', href: '/alternatives' },
          { label: `${alt.name} alternative` },
        ]}
      />
      <main className="pb-20 sm:pb-24" style={voiceStyle(voice)}>
        <PageHero
          eyebrow={
            <>
              {voice.apps.length === 1 && <AppMark app={voice.apps[0]!} className="size-4" />}
              {voice.name} vs {alt.name}
            </>
          }
          title={alt.h1}
          lede={alt.lede}
        >
          <div className="mt-8 flex justify-center">
            <VsBadge slug={alt.slug} voice={voice} />
          </div>
        </PageHero>

        <div className="mx-auto mt-14 grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[14rem_1fr] lg:gap-14">
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
                <ComparisonTable alt={alt} voice={voice} />
              </div>
            </section>

            {/* Honest two-sided takeaway (liveworkspace/docs/comparison-pages.md "Golden rule"). */}
            <section
              id="which-to-pick"
              aria-labelledby="which-to-pick-title"
              className="scroll-mt-24"
            >
              <h2 id="which-to-pick-title" className={H2}>
                Which to pick
              </h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--lw-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--lw-accent)_7%,transparent)] p-6">
                  <h3 className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                      {voice.apps.length === 1 ? (
                        <AppMark app={voice.apps[0]!} className="size-5" />
                      ) : (
                        <span className="text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">
                          <CheckIcon />
                        </span>
                      )}
                    </span>
                    Why pick {voice.name}
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {alt.usBest.map((point) => (
                      <li key={point} className="flex gap-2.5">
                        <span className="mt-0.5 shrink-0 text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">
                          <CheckIcon />
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
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

            {/* Deep-dive sections: competitor-specific prose expanding the key value themes behind
                the bullets above. */}
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
              body="No sign-up, nothing to install, free forever. Open it and judge for yourself."
              voice={voice}
            />

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparisons reflect each product&rsquo;s general positioning and may change. Check{' '}
              {alt.name}&rsquo;s own site for current details. Last reviewed{' '}
              {alt.updated.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
              .
            </p>
          </div>
        </div>

        <section aria-labelledby="others-title" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
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
