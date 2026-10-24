import { describe, expect, it } from 'vitest';

import { faqAnswerText, filterFaq, type FaqCategory } from './faq';

const icon = (() => null) as unknown as FaqCategory['icon'];
const CATEGORIES: FaqCategory[] = [
  {
    id: 'free',
    title: 'Pricing',
    blurb: 'What it costs.',
    icon,
    items: [{ q: 'Is it really free?', a: 'Yes, with no paywall.' }],
  },
  {
    id: 'export',
    title: 'Import and export',
    blurb: 'Getting work in and out.',
    icon,
    items: [{ q: 'Can I export my work?', a: null, aText: 'As PNG, SVG or CSV.' }],
  },
];

describe('faqAnswerText', () => {
  it('reads a string answer, else the plain-text restatement', () => {
    expect(faqAnswerText(CATEGORIES[0]!.items[0]!)).toBe('Yes, with no paywall.');
    expect(faqAnswerText(CATEGORIES[1]!.items[0]!)).toBe('As PNG, SVG or CSV.');
  });
});

describe('filterFaq', () => {
  it('returns the list untouched for an empty query', () => {
    expect(filterFaq(CATEGORIES, '   ')).toBe(CATEGORIES);
  });

  it('needs every word, in any case, across question, answer and category', () => {
    expect(filterFaq(CATEGORIES, 'csv EXPORT').map((c) => c.id)).toEqual(['export']);
    expect(filterFaq(CATEGORIES, 'pricing paywall').map((c) => c.id)).toEqual(['free']);
  });

  it('drops categories left empty, and everything for a query nothing matches', () => {
    expect(filterFaq(CATEGORIES, 'zzzqqq')).toEqual([]);
  });
});
