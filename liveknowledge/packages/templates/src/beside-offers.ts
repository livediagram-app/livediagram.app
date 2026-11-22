// The templates that offer a file beside them (docs/specs/008-canvas/canvas-and-palette.md "Written documents";
// liveworkspace/docs/specs/004-index/connected-tabs.md "A file made beside it", Work Tracker 1281): Design Doc and
// Status Report describe work a plan tracks, so a document holding either offers Make a plan beside it in Connect File.
// A tab says which template made it by its article's flow id, which the template writes and the tab keeps, so no new
// field is stored. Pure and tiny: the editor reads it on every start screen, never the template builders.

// The offers the index makes (`BESIDE_OFFERS`, @liveworkspace/index-client beside.ts), by id.
export type BesideTemplateOffer = 'plan';

// Each offering template's article flow id (article-templates.ts), and what it offers. Pinned to the templates' own
// flows by beside-offers.test.ts.
export const BESIDE_TEMPLATE_OFFERS: Readonly<Record<string, BesideTemplateOffer>> = {
  // Design Doc
  'art-design-doc': 'plan',
  // Status Report
  'art-status': 'plan',
};

type PagedTab = { pages?: readonly { kind?: string; flow?: string }[] };

/** The offer a document's tabs make: the first tab holding an offering template's article, or null. */
export function besideOfferOf(tabs: readonly PagedTab[]): BesideTemplateOffer | null {
  for (const tab of tabs)
    for (const page of tab.pages ?? []) {
      // Own keys only: a flow named `constructor` is no offer.
      if (page.kind === 'article' && page.flow && Object.hasOwn(BESIDE_TEMPLATE_OFFERS, page.flow))
        return BESIDE_TEMPLATE_OFFERS[page.flow]!;
    }
  return null;
}
