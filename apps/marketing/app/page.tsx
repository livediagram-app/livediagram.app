import { Fragment, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { FeatureCategoryBlock } from '@/components/FeatureCategoryBlock';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { PrivacySection } from '@/components/PrivacySection';
import { StartDrawingCta } from '@/components/StartDrawingCta';
import { LANDING_SECTIONS } from '@/lib/landing-content';
// Lazy-load TemplateGallery: the `'use client'` gallery (search state +
// forty-odd preview SVGs) sits below several feature sections (well below
// the fold), none of which the initial paint needs. The static-export HTML
// still inlines its markup (next/dynamic defaults to ssr: true), so SEO
// and first scroll are unchanged; what shrinks is the hydration JS chunk
// the browser fetches before the user has any reason to look at it.
const TemplateGallery = dynamic(() =>
  import('@/components/TemplateGallery').then((m) => m.TemplateGallery),
);

// Non-feature interludes that render after a given section's anchor id.
const INTERLUDES: Record<string, ReactNode> = {
  collaboration: <TemplateGallery />,
  reliability: <PrivacySection />,
};

export default function LandingPage() {
  return (
    <>
      <Header surface="Home" />
      <main>
        <Hero />

        {/* Each feature category is pitched as a compact advertising block that
            links into its own /features/<id> page, rather than enumerating
            every feature card inline (spec/16). The block alternates its art
            side + tinted background by index for rhythm. */}
        {LANDING_SECTIONS.map((section, index) => (
          <Fragment key={section.id}>
            <FeatureCategoryBlock section={section} index={index} />
            {INTERLUDES[section.id]}
          </Fragment>
        ))}

        <StartDrawingCta surface="Home" />
      </main>
      <Footer />
    </>
  );
}
