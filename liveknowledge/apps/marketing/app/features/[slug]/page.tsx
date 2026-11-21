import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeatureGrid, Section } from '@liveworkspace/marketing-site/components/Section';

import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { FeatureCategoryHero } from '@/components/features/FeatureCategoryHero';
import { OtherCategories } from '@/components/features/OtherCategories';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StartDrawingCta } from '@/components/StartDrawingCta';
import { getLandingSection, LANDING_SECTION_IDS } from '@/lib/landing-content';
import { pageMetadata } from '@/lib/seo';

// One page per landing section at /features/<id> (docs/specs/019-marketing/marketing-site.md "Feature pages"),
// read from the same LANDING_SECTIONS entry: the landing page tells each section as a story beat, and this page
// breaks it into its features, each an illustrated card. Static export: only the known ids are generated, so an
// unknown slug is a 404 at build rather than a page.
export const dynamicParams = false;

export function generateStaticParams() {
  return LANDING_SECTION_IDS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const section = getLandingSection(slug);
  if (!section) return {};
  return pageMetadata({
    title: `${section.label}: ${section.title} | liveknowledge`,
    description: section.metaDescription,
    path: `/features/${slug}`,
  });
}

export default async function FeatureCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = getLandingSection(slug);
  if (!section) notFound();

  return (
    <>
      <BreadcrumbJsonLd name={section.label} path={`/features/${slug}`} />
      <Header surface="Feature" />
      <main>
        <Breadcrumb items={[{ label: section.label }]} />
        <FeatureCategoryHero section={section} />
        <Section id="features" title={`Everything in ${section.label}`}>
          <FeatureGrid items={section.items} />
        </Section>
        <OtherCategories currentId={section.id} />
        <StartDrawingCta surface="Feature" />
      </main>
      <Footer />
    </>
  );
}
