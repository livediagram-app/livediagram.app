import { describe, expect, it } from 'vitest';
import { articleTemplateOverridesFor } from './article-templates';
import { BESIDE_TEMPLATE_OFFERS, besideOfferOf } from './beside-offers';

// Each offering template's article flow, as the template writes it.
const flowOf = (kind: 'design-doc' | 'status-report') =>
  (articleTemplateOverridesFor(kind).pages ?? [])[0]?.flow;

describe('the templates that offer a plan beside them (Work Tracker 1281)', () => {
  // What the index makes for each offer is the editor's to check: its BESIDE_OFFERS lookup takes only an offer id.
  it('names Design Doc and Status Report by the flows they write', () => {
    expect(Object.keys(BESIDE_TEMPLATE_OFFERS).sort()).toEqual(
      [flowOf('design-doc'), flowOf('status-report')].sort(),
    );
  });

  it('reads the offer off any tab holding such an article, and none elsewhere', () => {
    const article = (flow: string) => ({ pages: [{ kind: 'article', flow }] });
    expect(besideOfferOf([{}, article(flowOf('status-report')!)])).toBe('plan');
    expect(besideOfferOf([article(flowOf('design-doc')!)])).toBe('plan');
    expect(besideOfferOf([])).toBeNull();
    expect(besideOfferOf([article('art-meeting'), { pages: [{ kind: 'slide' }] }])).toBeNull();
    // A page of another kind with the flow, or a flow named after an object's own keys, offers nothing.
    expect(besideOfferOf([{ pages: [{ kind: 'slide', flow: 'art-status' }] }])).toBeNull();
    expect(besideOfferOf([article('constructor'), article('toString')])).toBeNull();
  });
});
