import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from './help-site';
import { SCOPE } from './scope.generated';
import { supportCopy, type SupportSlug } from './support-copy';

// The category landings, one app/<slug>/page.tsx each, bound to the build's scope. A landing the scope does not show
// (Plan in livediagram's help) renders the not-found page in that build; the Worker answers its address with a 308
// to the landing's canonical address before any file is served, and the build drops its folder.

export interface Landing {
  metadata: Metadata;
  Page: () => React.ReactNode;
}

const inScope = (slug: string) => site.catalogue.categories.some((c) => c.slug === slug);

const missing: Landing = {
  metadata: { robots: { index: false } },
  Page: () => notFound(),
};

/** A support landing: its articles as cards (Getting Started numbered), in the scope's copy. */
export function supportLanding(slug: SupportSlug, { numbered = false } = {}): Landing {
  const copy = supportCopy(SCOPE, slug);
  if (!copy || !inScope(slug)) return missing;
  return {
    metadata: supportCategoryMetadata(site, slug, copy),
    Page: () => <SupportCategoryPage site={site} slug={slug} copy={copy} numbered={numbered} />,
  };
}

/** A feature landing: its guides in their groups. */
export function featureLanding(slug: string): Landing {
  if (!inScope(slug)) return missing;
  return {
    metadata: featureCategoryMetadata(site, slug),
    Page: () => <FeatureCategoryIndex site={site} slug={slug} />,
  };
}
