import { faqAnswerText, type FaqCategory } from './faq-content';

// The FAQ search (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"): every word of the query must
// appear, case-insensitively, in the question, its plain-text answer or its category's title. Categories left
// with no question drop out; an empty query returns the list untouched.
export function filterFaq(categories: FaqCategory[], query: string): FaqCategory[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return categories;
  return categories
    .map((c) => ({
      ...c,
      items: c.items.filter((item) => {
        const haystack = `${item.q} ${faqAnswerText(item)} ${c.title}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      }),
    }))
    .filter((c) => c.items.length > 0);
}
