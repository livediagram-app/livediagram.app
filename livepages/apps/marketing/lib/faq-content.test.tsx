// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { THEMES } from '@livepages/document';
import {
  LOGO_LAYOUTS,
  PAGE_LAYOUTS,
  SLIDE_LAYOUTS,
  TEMPLATE_CATEGORIES,
  TEMPLATES,
} from '@livepages/templates';

import { COMPETITOR_LOOK } from '@/components/compare/competitor-look';

import { ALTERNATIVES } from './alternatives';
import { LANDING_SECTIONS } from './landing-content';
import {
  FAQ_CATEGORIES,
  faqAnswerText,
  LOGO_LAYOUT_COUNT,
  PAGE_LAYOUT_COUNT,
  SLIDE_LAYOUT_COUNT,
  TEMPLATE_CATEGORY_COUNT,
  TEMPLATE_COUNT,
} from './faq-content';
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
    expect(TEMPLATE_CATEGORY_COUNT).toBe(TEMPLATE_CATEGORIES.length);
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

// Theme counts are written out as digits or words; each must match the theme catalogue.
describe('theme counts in marketing copy', () => {
  const WORDS: Record<string, number> = { 'twenty-four': 24 };
  it('matches the catalogue in the FAQ, the landing page and every comparison page', () => {
    const copy = JSON.stringify([
      FAQ_CATEGORIES.map((c) => c.items.map((i) => faqAnswerText(i))),
      LANDING_SECTIONS.map((s) => s.items.map((i) => i.description)),
      ALTERNATIVES,
    ]);
    const counts = [
      ...copy.matchAll(/\b(\d+|twenty-[a-z]+) (?:one-click )?(?:whole-canvas )?themes\b/gi),
    ].map((m) => (/^\d+$/.test(m[1]!) ? Number(m[1]) : WORDS[m[1]!.toLowerCase()]));
    expect(counts.length).toBeGreaterThan(0);
    // The seasonal themes are the seasonal looks' own, never offered in a picker, so the copy counts the rest.
    const offered = THEMES.filter((t) => !t.seasonal).length;
    for (const n of counts) expect(n).toBe(offered);
  });
});

// Slide layout counts are written out too, as digits or a word; each must match Pages mode's catalogue.
describe('slide layout counts in marketing copy', () => {
  const WORDS: Record<string, number> = { seventeen: 17 };
  const countsIn = (copy: string) =>
    [...copy.matchAll(/\b(\d+|[a-z]+teen) (?:ready-made )?layouts\b/gi)].map((m) =>
      /^\d+$/.test(m[1]!) ? Number(m[1]) : WORDS[m[1]!.toLowerCase()],
    );

  it('matches the catalogue in the FAQ', () => {
    expect(SLIDE_LAYOUT_COUNT).toBe(SLIDE_LAYOUTS.length);
  });

  it('matches the infographic and logo catalogues in the FAQ', () => {
    expect(PAGE_LAYOUT_COUNT).toBe(PAGE_LAYOUTS.length);
    expect(LOGO_LAYOUT_COUNT).toBe(LOGO_LAYOUTS.length);
  });

  it('matches the infographic and logo catalogues on the landing page', () => {
    // Written as words in the cards; a catalogue change fails here until the copy follows it.
    const WORD: Record<number, string> = { 25: 'twenty-five', 92: 'Ninety-two' };
    const copy = JSON.stringify(LANDING_SECTIONS.map((s) => s.items.map((i) => i.description)));
    expect(copy).toContain(`${WORD[PAGE_LAYOUTS.length]} ready-made pages`);
    expect(copy).toContain(`${WORD[LOGO_LAYOUTS.length]} logo layouts`);
  });

  it('matches the catalogue on every comparison page', () => {
    const counts = countsIn(JSON.stringify(ALTERNATIVES));
    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) expect(n).toBe(SLIDE_LAYOUTS.length);
  });
});

describe('filterFaq', () => {
  it('returns the list untouched for an empty query', () => {
    expect(filterFaq(FAQ_CATEGORIES, '   ')).toBe(FAQ_CATEGORIES);
  });

  it('needs every word, in any case, across question, answer and category', () => {
    const hits = filterFaq(FAQ_CATEGORIES, 'LOGO kit export').flatMap((c) =>
      c.items.map((i) => i.q),
    );
    expect(hits).toContain('Can I export my work?');
    expect(hits.every((q) => q !== 'Is it really free?')).toBe(true);
  });

  it('drops categories left empty, and everything for a query nothing matches', () => {
    expect(filterFaq(FAQ_CATEGORIES, 'self-host').map((c) => c.id)).toContain('self-hosting');
    expect(filterFaq(FAQ_CATEGORIES, 'zzzqqq')).toEqual([]);
  });
});
