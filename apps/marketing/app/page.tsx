import dynamic from 'next/dynamic';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { PrivacySection } from '@/components/PrivacySection';
import { StartDrawingCta } from '@/components/StartDrawingCta';
import { StoryBeat } from '@/components/StoryBeat';
import { LANDING_BEATS } from '@/lib/landing-beats';
// Lazy-load TemplateGallery: the `'use client'` gallery (search state +
// forty-odd preview SVGs) sits under the hero's tall illustration, so the
// first paint never needs it. The static-export HTML still inlines its
// markup (next/dynamic defaults to ssr: true), so SEO and first scroll are
// unchanged; what's deferred is the hydration JS chunk.
const TemplateGallery = dynamic(() =>
  import('@/components/TemplateGallery').then((m) => m.TemplateGallery),
);

// The page tells one story (docs/specs/019-marketing/marketing-site.md): what it is, one click to a real
// diagram, then five beats that each cover a few feature categories and link
// into all of them.
export default function LandingPage() {
  return (
    <>
      <Header surface="Home" />
      <main>
        <Hero />
        <TemplateGallery />
        {LANDING_BEATS.map((beat, index) => (
          <StoryBeat key={beat.id} beat={beat} index={index} />
        ))}
        <PrivacySection />
        <StartDrawingCta surface="Home" />
      </main>
      <Footer />
    </>
  );
}
