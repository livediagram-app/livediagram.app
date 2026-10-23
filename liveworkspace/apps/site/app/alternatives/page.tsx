import { JsonLd } from '@livediagram/ui';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { AlternativeCard } from '@/components/compare/AlternativeCard';
import {
  Breadcrumb,
  BreadcrumbJsonLd,
  compareMetadata,
  PageHero,
} from '@/components/compare/compare-chrome';
import { compareVoice, voiceStyle } from '@/components/compare/compare-theme';
import { TryItCard } from '@/components/compare/TryItCard';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AppMark } from '@/components/landing/AppLogo';
import { ALTERNATIVE_GROUPS, ALTERNATIVES, ALTERNATIVES_LAST_UPDATED } from '@/lib/alternatives';
import { listedApps } from '@/lib/apps';

// The comparison hub (liveworkspace/docs/comparison-pages.md "Routes"): a crawlable parent linking
// every /alternatives/<slug> page, grouped by what answers it: the whole suite first, then each app.

// Every competitor by name, read from the data so a new comparison updates the hub's ItemList too.
// The meta description stays a fixed sentence: listing every name would outgrow a search result's
// 160 characters.
const COMPETITORS = new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(
  ALTERNATIVES.map((alt) => alt.name),
);

export const metadata = compareMetadata({
  title: 'How liveworkspace compares · alternatives',
  description:
    'Honest, side-by-side comparisons of liveworkspace and its apps with Miro, Trello, Notion, Google Slides, Figma and more, including where each is the better pick.',
  path: '/alternatives',
  modified: ALTERNATIVES_LAST_UPDATED,
});

// ItemList JSON-LD: the schema.org shape for a curated index of related pages, built from the same
// list as the visible grid and the sitemap.
const ITEM_LIST_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'How liveworkspace compares',
  description: `Side-by-side comparisons of liveworkspace and its apps against ${COMPETITORS}.`,
  itemListOrder: 'https://schema.org/ItemListOrderAscending',
  numberOfItems: ALTERNATIVES.length,
  itemListElement: ALTERNATIVES.map((alt, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${PLATFORM_SITE.url}/alternatives/${alt.slug}`,
    name: `${compareVoice(alt.apps).name} vs ${alt.name}`,
  })),
};

export default function AlternativesIndexPage() {
  const apps = listedApps();
  const platform = compareVoice([]);
  return (
    <>
      <JsonLd data={ITEM_LIST_JSON_LD} />
      <BreadcrumbJsonLd trail={[{ name: 'Product Comparison', path: '/alternatives' }]} />
      <Header />
      <Breadcrumb items={[{ label: 'Product Comparison' }]} />
      <main className="pb-20 sm:pb-24" style={voiceStyle(platform)}>
        <PageHero
          eyebrow="Product Comparison"
          title="How liveworkspace compares"
          lede="Thinking about another tool? Here is an honest, side-by-side look at how liveworkspace and its apps compare, including where each one is the better pick."
        />
        <div className="mx-auto mt-14 max-w-7xl space-y-16 px-4 sm:px-6">
          {ALTERNATIVE_GROUPS.map((group) => {
            const app = apps.find((a) => a.id === group.app);
            return (
              <section key={group.app ?? 'suite'} aria-labelledby={`group-${app?.name ?? 'suite'}`}>
                <h2
                  id={`group-${app?.name ?? 'suite'}`}
                  className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white"
                >
                  {app ? (
                    <>
                      <AppMark app={app} className="size-6" />
                      {app.name}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        · {app.pitch.toLowerCase()}
                      </span>
                    </>
                  ) : (
                    'The whole suite'
                  )}
                </h2>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.alternatives.map((alt) => (
                    <AlternativeCard key={alt.slug} alt={alt} />
                  ))}
                </div>
              </section>
            );
          })}
          <TryItCard
            title="Or just try it"
            body="No sign-up, nothing to install, free forever. The fastest comparison is your own."
            voice={platform}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
