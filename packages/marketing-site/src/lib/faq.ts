import type { lucideGlyph } from '@liveworkspace/ui';
import type { ReactNode } from 'react';

// The /faq page's shape (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)", in each product):
// questions grouped into categories, each with an icon and a one-line blurb. The questions are each product's own
// (its lib/faq-content.tsx).
//
// Each entry's `a` is what renders on the page (a ReactNode, so prose can mix in links). `aText` is the plain-text
// form the FAQPage JSON-LD emits, since schema.org's Answer.text expects a string: entries whose `a` is already a
// string omit it, the rest restate the answer sans markup.

export type FaqItem = { q: string; a: ReactNode; aText?: string };
export type FaqCategory = {
  id: string;
  title: string;
  blurb: string;
  icon: ReturnType<typeof lucideGlyph>;
  items: FaqItem[];
};

// The plain-text answer for the JSON-LD and the page search.
export function faqAnswerText(item: FaqItem): string {
  return item.aText ?? (typeof item.a === 'string' ? item.a : '');
}

// The FAQ search: every word of the query must appear, case-insensitively, in the question, its plain-text answer
// or its category's title. Categories left with no question drop out; an empty query returns the list untouched.
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
