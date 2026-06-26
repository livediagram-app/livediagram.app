import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { FeatureCategoryHero } from '@/components/FeatureCategoryHero';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { FeatureGrid, Section } from '@/components/Section';
import { StartDrawingCta } from '@/components/StartDrawingCta';
import {
  getLandingSection,
  groupSectionFeatures,
  LANDING_SECTION_IDS,
} from '@/lib/landing-content';
import { subpageMetadata } from '@/lib/subpage-metadata';

// One detail page per feature category at /features/<id>, reading the matching
// LANDING_SECTIONS entry (see specs/16-marketing-site.md "Feature category
// pages"). The landing page advertises each category in a compact block; the
// full grid of feature cards lives here. Static export: only the known section
// ids are generated, so an unknown slug 404s at build rather than rendering.
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
  return subpageMetadata({
    title: `${section.title} — livediagram features`,
    description: section.description,
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

  // Larger categories tag their features into groups; render those as captioned
  // sub-sections so the grid stays scannable. Smaller ones render one flat grid.
  const groups = groupSectionFeatures(section);

  return (
    <>
      <BreadcrumbJsonLd name={section.title} path={`/features/${slug}`} />
      <Header />
      <main>
        <Breadcrumb items={[{ label: section.title }]} />
        <FeatureCategoryHero section={section} />
        <Section id={section.id} title="Everything in this category">
          {groups ? (
            <div className="space-y-16">
              {groups.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-6 text-xl font-semibold tracking-tight text-slate-900">
                    {group.title}
                  </h3>
                  <FeatureGrid items={group.items} />
                </div>
              ))}
            </div>
          ) : (
            <FeatureGrid items={section.items} />
          )}
        </Section>
        <StartDrawingCta />
      </main>
      <Footer />
    </>
  );
}
