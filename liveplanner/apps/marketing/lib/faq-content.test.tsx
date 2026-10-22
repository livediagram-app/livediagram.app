// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { TEMPLATES, isBlankTemplate, isPlanTemplate } from '@liveplanner/templates';

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

// The templates marketing shows: the listed Plan ones (boards, sheets, dashboards and forms), blanks aside.
const PLAN_TEMPLATES = TEMPLATES.filter(
  (t) => !t.hidden && isPlanTemplate(t.kind) && !isBlankTemplate(t.kind),
);

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
  it('matches the Plan templates in the FAQ', () => {
    expect(TEMPLATE_COUNT).toBe(PLAN_TEMPLATES.length);
  });

  it('matches the Plan templates on any comparison page or card that counts them', () => {
    const copy = JSON.stringify([
      ALTERNATIVES,
      Object.values(COMPETITOR_LOOK).map((l) => l.highlights),
    ]);
    const counts = [...copy.matchAll(/(\d+) (?:ready-made |starter )?templates/g)].map((m) =>
      Number(m[1]),
    );
    for (const n of counts) expect(n).toBe(PLAN_TEMPLATES.length);
  });
});

describe('filterFaq', () => {
  it('returns the list untouched for an empty query', () => {
    expect(filterFaq(FAQ_CATEGORIES, '   ')).toBe(FAQ_CATEGORIES);
  });

  it('needs every word, in any case, across question, answer and category', () => {
    const hits = filterFaq(FAQ_CATEGORIES, 'CSV export').flatMap((c) => c.items.map((i) => i.q));
    expect(hits).toContain('Can I export my work?');
    expect(hits.every((q) => q !== 'Is it really free?')).toBe(true);
  });

  it('drops categories left empty, and everything for a query nothing matches', () => {
    expect(filterFaq(FAQ_CATEGORIES, 'paywall').map((c) => c.id)).toEqual(['free']);
    expect(filterFaq(FAQ_CATEGORIES, 'zzzqqq')).toEqual([]);
  });
});

describe('domain language', () => {
  const copy = items.map((i) => `${i.q} ${faqAnswerText(i)}`).join(' ');

  // A person reads "project"; "document" is only the code's word for one.
  it('calls a project a project, never a document', () => {
    expect(copy).not.toMatch(/\bdocuments?\b/i);
    expect(copy).toMatch(/\bprojects?\b/);
  });

  // liveplanner plans work; the diagramming modes are not part of it.
  it('never offers diagrams, whiteboards, slides or articles', () => {
    expect(copy).not.toMatch(
      /\b(?:diagrams?|whiteboards?|slides?|infographics?|articles?|mermaid)\b/i,
    );
  });
});
