// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { TEMPLATES } from '@livediagram/templates';

import { COMPETITOR_LOOK } from '@/components/compare/competitor-look';

import { ALTERNATIVES } from './alternatives';
import { FAQ_CATEGORIES, faqAnswerText, TEMPLATE_COUNT } from './faq-content';
import { filterFaq } from './faq-filter';

const items = FAQ_CATEGORIES.flatMap((c) => c.items);

// The visible text of a rendered answer, as a reader (or a crawler) sees it: rendered into the DOM and read
// back, so the browser does the parsing, not a hand-rolled tag strip.
const visibleText = (node: ReactNode) => {
  const { container, unmount } = render(<>{node}</>);
  const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim();
  unmount();
  return text;
};

describe('FAQ content', () => {
  it('gives every category a unique id and at least one question', () => {
    const ids = FAQ_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of FAQ_CATEGORIES) expect(c.items.length).toBeGreaterThan(0);
  });

  it('never repeats a question', () => {
    const qs = items.map((i) => i.q);
    expect(new Set(qs).size).toBe(qs.length);
  });

  it('keeps every plain-text answer (the JSON-LD) identical to what the page renders', () => {
    for (const item of items) {
      expect(faqAnswerText(item), item.q).not.toBe('');
      expect(faqAnswerText(item), item.q).toBe(visibleText(item.a));
    }
  });
});

// The template count is written out where it ships to the browser; every mention must match the catalogue.
describe('template counts in marketing copy', () => {
  it('matches the catalogue in the FAQ', () => {
    expect(TEMPLATE_COUNT).toBe(TEMPLATES.length);
  });

  it('matches the catalogue on every comparison page and card', () => {
    const copy = JSON.stringify([
      ALTERNATIVES,
      Object.values(COMPETITOR_LOOK).map((l) => l.highlights),
    ]);
    const counts = [...copy.matchAll(/(\d+) (?:starter )?templates/g)].map((m) => Number(m[1]));
    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) expect(n).toBe(TEMPLATES.length);
  });
});

describe('filterFaq', () => {
  it('returns the list untouched for an empty query', () => {
    expect(filterFaq(FAQ_CATEGORIES, '   ')).toBe(FAQ_CATEGORIES);
  });

  it('needs every word, in any case, across question, answer and category', () => {
    const hits = filterFaq(FAQ_CATEGORIES, 'MERMAID export').flatMap((c) =>
      c.items.map((i) => i.q),
    );
    expect(hits).toContain('Does it work with Mermaid?');
    expect(hits.every((q) => q !== 'Is it really free?')).toBe(true);
  });

  it('drops categories left empty, and everything for a query nothing matches', () => {
    expect(filterFaq(FAQ_CATEGORIES, 'self-host').map((c) => c.id)).toContain('self-hosting');
    expect(filterFaq(FAQ_CATEGORIES, 'zzzqqq')).toEqual([]);
  });
});
