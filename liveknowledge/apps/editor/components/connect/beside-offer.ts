// Make a plan beside it (liveworkspace/docs/specs/004-index/connected-tabs.md "A file made beside it", Work Tracker
// 1281): the offer a document's Connect File list shows. Offered while a tab holds Design Doc or Status Report (read off
// the article flow each writes, besideOfferOf) and no tab is connected to the offer's app yet, since one plan beside it
// is enough. One pass over the tabs and their pages.
import { BESIDE_OFFERS, type BesideOffer } from '@liveworkspace/index-client';
import { besideOfferOf } from '@liveknowledge/templates/beside-offers';

type OfferTab = Parameters<typeof besideOfferOf>[0][number] & {
  connection?: { app: string } | null;
};

export function besideOfferFor(tabs: readonly OfferTab[]): BesideOffer | undefined {
  const id = besideOfferOf(tabs);
  if (!id) return undefined;
  const offer = BESIDE_OFFERS[id];
  return tabs.some((t) => t.connection?.app === offer.app) ? undefined : offer;
}
