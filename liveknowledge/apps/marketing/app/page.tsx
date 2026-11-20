import dynamic from 'next/dynamic';
import { BuildWithAiBand } from '@/components/BuildWithAiBand';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { LandingFaq } from '@/components/LandingFaq';
import { PrivacySection } from '@/components/PrivacySection';
import { PromisePrism } from '@/components/PromisePrism';
import { StartDrawingCta } from '@/components/StartDrawingCta';
import { StoryBeat } from '@/components/StoryBeat';
import { LANDING_SECTIONS } from '@/lib/landing-content';
// Lazy-load TemplateGallery: the `'use client'` gallery (its open shelf's state and the template previews) sits
// far below the first screen. The static-export HTML still inlines its markup (next/dynamic defaults to
// ssr: true), so SEO and first scroll are unchanged; what is deferred is the hydration JS chunk.
const TemplateGallery = dynamic(() =>
  import('@/components/TemplateGallery').then((m) => m.TemplateGallery),
);
// The Community section (docs/specs/025-community/community.md "Featured on the home page") loads its six
// after the page does, so its chunk is deferred the same way.
const CommunityShowcase = dynamic(() =>
  import('@/components/CommunityShowcase').then((m) => m.CommunityShowcase),
);

// The page tells one story (docs/specs/019-marketing/marketing-site.md "Structure"): what liveknowledge is, its
// promises, a beat per thing it does (each with its own art), how agents connect, the templates and the
// Community, privacy, the honest answers, and the way in.
export default function LandingPage() {
  return (
    <>
      <Header surface="Home" />
      <main>
        <Hero />
        <PromisePrism />
        {LANDING_SECTIONS.map((section, index) => (
          <StoryBeat key={section.id} section={section} index={index} />
        ))}
        <BuildWithAiBand />
        <TemplateGallery />
        <CommunityShowcase />
        <PrivacySection />
        <LandingFaq />
        <StartDrawingCta surface="Home" />
      </main>
      <Footer />
    </>
  );
}
