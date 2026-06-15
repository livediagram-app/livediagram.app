import { Fragment, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { PrivacySection } from '@/components/PrivacySection';
import { FeatureGrid, Section } from '@/components/Section';
import { LANDING_SECTIONS } from '@/lib/landing-content';
// Lazy-load UseCaseCarousel: the 470-line `'use client'` rotator
// sits below several feature sections (well below the fold) and
// carries its own state + sketch components, none of which the
// initial paint needs. The static-export HTML still inlines its
// markup (next/dynamic defaults to ssr: true), so SEO and first
// scroll are unchanged; what shrinks is the hydration JS chunk
// the browser fetches before the user has any reason to look at
// the carousel.
const UseCaseCarousel = dynamic(() =>
  import('@/components/UseCaseCarousel').then((m) => m.UseCaseCarousel),
);

// Non-feature interludes that render after a given section's anchor id.
const INTERLUDES: Record<string, ReactNode> = {
  collaboration: <UseCaseCarousel />,
  reliability: <PrivacySection />,
};

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />

        {LANDING_SECTIONS.map((section, index) => (
          <Fragment key={section.id}>
            <Section
              id={section.id}
              title={section.title}
              description={section.description}
              // Alternate plain / tinted backgrounds by position so the rhythm
              // stays correct automatically when sections move or are added.
              variant={index % 2 === 1 ? 'tinted' : 'default'}
            >
              <FeatureGrid items={section.items} />
            </Section>
            {INTERLUDES[section.id]}
          </Fragment>
        ))}

        <section id="get-started" className="border-t border-slate-200/70 bg-brand-500">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Time to start
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-brand-50">
              No sign-up wall. No credit card. The editor opens in your browser and remembers the
              diagram next time you visit.
            </p>
            <div className="mt-8">
              <a
                href="/new"
                className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-base font-medium text-brand-700 shadow-sm transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Start drawing
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
