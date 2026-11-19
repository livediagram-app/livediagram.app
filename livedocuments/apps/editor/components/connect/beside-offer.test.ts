// Make a plan beside it (liveworkspace/docs/specs/004-index/connected-tabs.md "A file made beside it", Work Tracker
// 1281): offered by a document holding Design Doc or Status Report, until a tab is connected to a plan.
import { describe, expect, it } from 'vitest';
import { BESIDE_OFFERS } from '@liveworkspace/index-client';
import { besideOfferFor } from './beside-offer';

const designDoc = { pages: [{ kind: 'article', flow: 'art-design-doc' }] };
const statusReport = { pages: [{ kind: 'article', flow: 'art-status' }] };

describe('besideOfferFor', () => {
  it('offers a plan beside Design Doc and Status Report', () => {
    expect(besideOfferFor([designDoc])).toBe(BESIDE_OFFERS.plan);
    expect(besideOfferFor([{}, statusReport])).toBe(BESIDE_OFFERS.plan);
  });

  it('offers nothing in any other document', () => {
    expect(besideOfferFor([])).toBeUndefined();
    expect(besideOfferFor([{ pages: [{ kind: 'article', flow: 'art-meeting' }] }])).toBeUndefined();
  });

  it('offers nothing once a tab is connected to a plan, whatever else is connected', () => {
    expect(besideOfferFor([designDoc, { connection: { app: 'liveplanner' } }])).toBeUndefined();
    expect(besideOfferFor([designDoc, { connection: { app: 'livediagram' } }])).toBe(
      BESIDE_OFFERS.plan,
    );
    expect(besideOfferFor([designDoc, { connection: null }])).toBe(BESIDE_OFFERS.plan);
  });
});
