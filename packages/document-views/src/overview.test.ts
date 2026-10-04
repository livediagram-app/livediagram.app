import { describe, expect, it } from 'vitest';
import { isValidTab } from '@livediagram/document';
import { CHECKOUT_DOCUMENT, checkoutDocumentTabs } from './__fixtures__/checkout-document';
import { FIXED_EPOCH } from './__fixtures__/checkout-tab';
import { golden } from './__fixtures__/golden-path';
import { headerFactsOf } from './model';
import { editedAge, overviewView, type OverviewTabInput } from './overview';

const MINUTE = 60_000;
const tabs = checkoutDocumentTabs();
const tabIds = tabs.map((t) => t.id);
const inputs = (outOfScope: ReadonlySet<number> = new Set()): OverviewTabInput[] =>
  tabs.map((tab, i) =>
    outOfScope.has(i)
      ? { id: tab.id, outOfScope: true }
      : { id: tab.id, outOfScope: false, facts: headerFactsOf(tab, { tabIds, rev: i + 1 }) },
  );

describe('overviewView (R17, VW37)', () => {
  it('builds valid fixture tabs', () => {
    expect(tabs.every((tab) => isValidTab(tab))).toBe(true);
  });

  it('prints the document and one line per tab', async () => {
    const { text, json } = overviewView(CHECKOUT_DOCUMENT, inputs(), {
      now: FIXED_EPOCH + 3 * MINUTE,
    });
    await expect(text).toMatchFileSnapshot(golden('checkout.overview.txt'));
    expect(json.document).toEqual({ ...CHECKOUT_DOCUMENT, tabs: 3 });
    expect(json.tabs[2]).toMatchObject({
      outOfScope: false,
      view: 'overview',
      tab: { kind: 'event-storming' },
    });
    expect(json.elision).toBeNull();
  });

  it('names an out-of-scope tab by its ref alone', async () => {
    const { text, json } = overviewView(CHECKOUT_DOCUMENT, inputs(new Set([1])), {
      now: FIXED_EPOCH,
    });
    await expect(text).toMatchFileSnapshot(golden('checkout.overview-scoped.txt'));
    expect(json.tabs[1]).toEqual({ outOfScope: true, ref: '51c9' });
  });

  it('fits a budget', () => {
    const { text, json } = overviewView(CHECKOUT_DOCUMENT, inputs(), {
      now: FIXED_EPOCH,
      budget: 60,
      door: 'mcp',
    });
    expect(text.split('\n').at(-1)).toMatch(/^… \d tabs? hidden: read_document \{"budget":\d+\}$/);
    expect(json.tabs.length).toBeLessThan(3);
  });

  it('says how long ago the document was edited', () => {
    expect(editedAge(FIXED_EPOCH, FIXED_EPOCH - 5_000)).toBe('just now');
    expect(editedAge(FIXED_EPOCH, FIXED_EPOCH + 59_999)).toBe('just now');
    expect(editedAge(FIXED_EPOCH, FIXED_EPOCH + 3 * MINUTE)).toBe('3m ago');
    expect(editedAge(FIXED_EPOCH, FIXED_EPOCH + 5 * 60 * MINUTE)).toBe('5h ago');
    expect(editedAge(FIXED_EPOCH, FIXED_EPOCH + 12 * 24 * 60 * MINUTE)).toBe('12d ago');
    expect(editedAge(FIXED_EPOCH, FIXED_EPOCH + 30 * 24 * 60 * MINUTE)).toBe('2026-09-27');
  });
});

describe('headerFactsOf', () => {
  it("matches the model's facts without a context", () => {
    expect(headerFactsOf(tabs[0]!).tab.ref).toBe('0b34');
  });
});
