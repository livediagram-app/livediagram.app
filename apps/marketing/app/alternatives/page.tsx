import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { JsonLd } from '@/components/JsonLd';
import { ALTERNATIVES } from '@/lib/alternatives';
import { subpageMetadata } from '@/lib/subpage-metadata';

const SITE_URL = 'https://livediagram.app';

// Hub page for the comparison set (see specs/21-comparison-pages.md): a
// crawlable parent that links to every /alternatives/<slug> page.
export const metadata = subpageMetadata({
  title: 'How livediagram compares · alternatives',
  description:
    'How livediagram stacks up against Miro, XMind, Excalidraw, draw.io, and Google Slides for diagrams. Honest, side-by-side comparisons.',
  path: '/alternatives',
});

// ItemList JSON-LD (see spec/16 "JSON-LD structured data", spec/21
// "Metadata"). The schema.org shape Google expects for a curated
// index of related pages: tells crawlers the hub is a list-of-links
// page (not editorial content in its own right), pairs each entry
// with its destination URL + competitor-specific name, and can
// surface as a carousel-style rich result. Built from the same
// ALTERNATIVES array the visible <ul> + the sitemap consume so
// adding a competitor updates all three together.
const ITEM_LIST_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'How livediagram compares',
  description:
    'Side-by-side comparisons of livediagram against Miro, XMind, Excalidraw, draw.io, and Google Slides.',
  itemListOrder: 'https://schema.org/ItemListOrderAscending',
  numberOfItems: ALTERNATIVES.length,
  itemListElement: ALTERNATIVES.map((alt, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE_URL}/alternatives/${alt.slug}`,
    name: `livediagram vs ${alt.name}`,
  })),
};

export default function AlternativesIndexPage() {
  return (
    <>
      <JsonLd data={ITEM_LIST_JSON_LD} />
      <BreadcrumbJsonLd name="Alternatives" path="/alternatives" />
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          How livediagram compares
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          Thinking about another tool? Here&rsquo;s an honest, side-by-side look at how livediagram
          compares, including where each one is the better pick.
        </p>
        <ul className="mt-10 space-y-3">
          {ALTERNATIVES.map((alt) => (
            <li key={alt.slug}>
              <a
                href={`/alternatives/${alt.slug}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
              >
                <span>
                  <span className="block font-semibold text-slate-900">{alt.h1}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    livediagram vs {alt.name}
                  </span>
                </span>
                <span aria-hidden className="text-brand-500">
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-700">Or just try it, no sign-up required.</p>
          <a
            href="/live/new"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Start drawing
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
