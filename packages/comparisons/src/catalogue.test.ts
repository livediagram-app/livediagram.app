import { describe, expect, it } from 'vitest';
import {
  comparisonCard,
  comparisonPath,
  comparisonSitemap,
  comparisonSlugs,
  faqJsonLd,
  getComparison,
  hubItemListJsonLd,
  otherComparisons,
  reviewedOn,
} from './catalogue';
import { comparisons } from './test/fixture';

const c = comparisons();

describe('the catalogue', () => {
  it('addresses every comparison under /alternatives', () => {
    expect(comparisonPath('miro')).toBe('/alternatives/miro');
    expect(comparisonSlugs(c)).toEqual(['miro', 'trello', 'figma', 'jira']);
  });

  it('finds a slug exactly as written, and nothing for any other', () => {
    expect(getComparison(c, 'miro')?.name).toBe('Miro');
    expect(getComparison(c, 'MIRO')).toBeUndefined();
    expect(getComparison(c, '')).toBeUndefined();
  });

  it('links each page on to the next three, wrapping round, never itself', () => {
    expect(otherComparisons(c, 'miro').map((a) => a.slug)).toEqual(['trello', 'figma', 'jira']);
    expect(otherComparisons(c, 'figma').map((a) => a.slug)).toEqual(['jira', 'miro', 'trello']);
    expect(otherComparisons(c, 'jira', 2).map((a) => a.slug)).toEqual(['miro', 'trello']);
  });

  it('lists every comparison in the hub ItemList, by absolute URL, in display order', () => {
    const list = hubItemListJsonLd(c);
    expect(list.numberOfItems).toBe(4);
    expect(list.description).toBe(
      'Side-by-side comparisons of testapp against Miro, Trello, Figma and Jira.',
    );
    expect(list.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      url: 'https://testapp.example/alternatives/miro',
      name: 'testapp vs Miro',
    });
  });

  it('mirrors each FAQ into the FAQPage JSON-LD word for word', () => {
    const alt = c.alternatives[0]!;
    expect(faqJsonLd(alt).mainEntity).toEqual([
      {
        '@type': 'Question',
        name: alt.faqs[0]!.q,
        acceptedAnswer: { '@type': 'Answer', text: alt.faqs[0]!.a },
      },
    ]);
  });

  it('sitemaps the hub and every page, dated by the review', () => {
    const entries = comparisonSitemap(c);
    expect(entries.map((e) => e.url)).toEqual([
      'https://testapp.example/alternatives',
      'https://testapp.example/alternatives/miro',
      'https://testapp.example/alternatives/trello',
      'https://testapp.example/alternatives/figma',
      'https://testapp.example/alternatives/jira',
    ]);
    for (const e of entries) expect(e.lastModified).toBe(c.updated);
  });

  it('words a social card for a comparison, and for the hub', () => {
    expect(comparisonCard(c, c.alternatives[0])).toEqual({
      kicker: 'testapp vs Miro',
      title: 'The free Miro alternative',
      subtitle: c.alternatives[0]!.description,
    });
    expect(comparisonCard(c, undefined).title).toBe('How testapp compares');
  });

  it('prints the review date in UTC', () => {
    expect(reviewedOn(new Date('2026-10-23'))).toBe('23 October 2026');
  });
});
