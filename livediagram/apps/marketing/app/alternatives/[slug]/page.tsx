import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  ComparisonArticle,
  comparisonPath,
  comparisonSlugs,
  faqJsonLd,
  getComparison,
  HUB_PATH,
  VsBadge,
} from '@liveworkspace/comparisons';
import { BrandMark, JsonLd, pageMetadata } from '@livediagram/ui';

import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { PageHero } from '@/components/PageHero';
import { TryItCard } from '@/components/TryItCard';
import { COMPARISONS } from '@/lib/alternatives';

// One page per competitor (packages/comparisons/README.md "Page shape"). Static export: only the
// known slugs are generated, so an unknown slug 404s at build rather than rendering.
export const dynamicParams = false;

export function generateStaticParams() {
  return comparisonSlugs(COMPARISONS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const alt = getComparison(COMPARISONS, (await params).slug);
  if (!alt) return {};
  // The page's own card is opengraph-image.tsx / twitter-image.tsx beside it.
  return pageMetadata({
    title: alt.title,
    description: alt.description,
    path: comparisonPath(alt.slug),
    modifiedTime: COMPARISONS.updated,
    ownOgImage: true,
  });
}

const mark = (className: string) => <BrandMark className={className} tone="mono" />;

export default async function AlternativePage({ params }: { params: Promise<{ slug: string }> }) {
  const alt = getComparison(COMPARISONS, (await params).slug);
  if (!alt) notFound();

  return (
    <>
      <JsonLd data={faqJsonLd(alt)} />
      <BreadcrumbJsonLd
        trail={[
          { name: 'Comparison', path: HUB_PATH },
          { name: `${alt.name} alternative`, path: comparisonPath(alt.slug) },
        ]}
      />
      <Header surface="Compare" />
      <Breadcrumb
        items={[
          { label: 'Comparison', href: HUB_PATH },
          { label: `${alt.name} alternative` },
        ]}
      />
      <main className="pb-20 sm:pb-24">
        <PageHero eyebrow={`${COMPARISONS.app} vs ${alt.name}`} title={alt.h1} lede={alt.lede}>
          <div className="mt-8 flex justify-center">
            <VsBadge slug={alt.slug} mark={mark} />
          </div>
        </PageHero>
        <ComparisonArticle
          comparisons={COMPARISONS}
          alt={alt}
          mark={mark}
          tryIt={
            <TryItCard
              title="See how it feels"
              body="No sign-up, nothing to install, free forever. Open a canvas and judge for yourself."
              source="Compare.Card"
            />
          }
        />
      </main>
      <Footer />
    </>
  );
}
