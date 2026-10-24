import { ComparisonHub, HUB_PATH, hubItemListJsonLd } from '@liveworkspace/comparisons';
import { BrandMark, JsonLd, pageMetadata } from '@livedocuments/ui';

import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { PageHero } from '@/components/PageHero';
import { TryItCard } from '@/components/TryItCard';
import { COMPARISONS } from '@/lib/alternatives';

// The comparison hub (packages/comparisons/README.md "Routes"): a crawlable parent linking every
// /alternatives/<slug> page, with an ItemList built from the same list as the grid and the sitemap.
const { hub } = COMPARISONS;

export const metadata = pageMetadata({
  title: hub.title,
  description: hub.description,
  path: HUB_PATH,
  modifiedTime: COMPARISONS.updated,
});

const mark = (className: string) => <BrandMark className={className} tone="mono" />;

export default function AlternativesIndexPage() {
  return (
    <>
      <JsonLd data={hubItemListJsonLd(COMPARISONS)} />
      <BreadcrumbJsonLd name="Comparison" path={HUB_PATH} />
      <Header surface="Compare" />
      <Breadcrumb items={[{ label: 'Comparison' }]} />
      <main className="pb-20 sm:pb-24">
        <PageHero eyebrow="Comparison" title={hub.heading} lede={hub.lede} />
        <ComparisonHub
          comparisons={COMPARISONS}
          mark={mark}
          tryIt={
            <TryItCard
              title="Or just try it"
              body="No sign-up, nothing to install, free forever. The fastest comparison is your own."
              source="Compare.Card"
              art
            />
          }
        />
      </main>
      <Footer />
    </>
  );
}
