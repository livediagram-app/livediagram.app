import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { AlternativeCard } from '@/components/compare/AlternativeCard';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { PageHero } from '@/components/PageHero';
import { TryItCard } from '@/components/TryItCard';
import { ALTERNATIVES, ALTERNATIVES_LAST_UPDATED } from '@/lib/alternatives';
import { JsonLd, pageMetadata, SITE_URL } from '@livediagram/ui';

// Hub page for the comparison set (see docs/specs/019-marketing/comparison-pages.md): a
// crawlable parent that links to every /alternatives/<slug> page.
// Every competitor by name, read from the data so a new comparison updates the hub's descriptions too.
const COMPETITORS = new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(
  ALTERNATIVES.map((alt) => alt.name),
);

export const metadata = pageMetadata({
  title: 'How livediagram compares · alternatives',
  description: `How livediagram stacks up against ${COMPETITORS}. Honest, side-by-side comparisons.`,
  path: '/alternatives',
  modifiedTime: ALTERNATIVES_LAST_UPDATED,
});

// ItemList JSON-LD (see docs/specs/019-marketing/marketing-site.md "JSON-LD structured data", docs/specs/019-marketing/comparison-pages.md
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
  description: `Side-by-side comparisons of livediagram against ${COMPETITORS}.`,
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
      <BreadcrumbJsonLd name="Product Comparison" path="/alternatives" />
      <Header surface="Compare" />
      <Breadcrumb items={[{ label: 'Product Comparison' }]} />
      <main className="pb-20 sm:pb-24">
        <PageHero
          eyebrow="Product Comparison"
          title="How livediagram compares"
          lede="Thinking about another tool? Here is an honest, side-by-side look at how livediagram compares, including where each one is the better pick."
        />
        <div className="mx-auto mt-14 grid max-w-6xl gap-5 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {ALTERNATIVES.map((alt) => (
            <AlternativeCard key={alt.slug} alt={alt} />
          ))}
          <TryItCard
            title="Or just try it"
            body="No sign-up, nothing to install, free forever. The fastest comparison is your own."
            source="Compare.Card"
            art
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
