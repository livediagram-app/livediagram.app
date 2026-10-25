// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { TEMPLATES, isBlankTemplate, isPlanTemplate } from '@liveplanner/templates';

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

  // A person reads "plan"; "document" is only the code's word for one.
  it('calls a plan a plan, never a document', () => {
    expect(copy).not.toMatch(/\bdocuments?\b/i);
    expect(copy).toMatch(/\bplans?\b/);
  });

  // liveplanner plans work; the diagramming modes are not part of it.
  it('never offers diagrams, whiteboards, slides or articles', () => {
    expect(copy).not.toMatch(
      /\b(?:diagrams?|whiteboards?|slides?|infographics?|articles?|mermaid)\b/i,
    );
  });
});

// The FAQ answers for liveplanner alone. Several sibling apps share the platform (the account, teams on
// liveworkspace.app), and liveworkspace may be named, but no answer may name another app or offer its kind of work.
// An answer about a genuine integration with another app goes in INTEGRATION_ANSWERS, by its question, and is the
// only place such a name may appear. None does today.
const INTEGRATION_ANSWERS: ReadonlySet<string> = new Set<string>([]);

const OTHER_APPS: readonly [string, RegExp][] = [
  ['another app by name', /\b(?:livediagram|livedocuments|livepages|livedesign)\b/i],
  [
    "livediagram's kinds of work",
    /\b(?:diagrams?|diagramming|flowcharts?|whiteboards?|mind ?maps?|mermaid|canvas(?:es)?|draw mode|workshop mode|community)\b/i,
  ],
  [
    "livedocuments' kinds of work",
    /\b(?:documents?|articles?|slides?|slide decks?|decks?|infographics?|presentations?)\b/i,
  ],
  [
    "livedesign's kinds of work",
    /\b(?:designs?|logos?|logo kits?|artboards?|wireframes?|mock-?ups?|prototypes?|photo edit(?:s|ing|or)?)\b/i,
  ],
];

describe('only about liveplanner', () => {
  it('lists only questions the FAQ asks as integration answers', () => {
    const asked = new Set(items.map((i) => i.q));
    for (const q of INTEGRATION_ANSWERS) expect(asked.has(q), q).toBe(true);
  });

  it.each(OTHER_APPS)('never names %s outside an integration answer', (_label, pattern) => {
    for (const c of FAQ_CATEGORIES)
      for (const item of c.items) {
        if (INTEGRATION_ANSWERS.has(item.q)) continue;
        const text = `${c.title} ${c.blurb} ${item.q} ${faqAnswerText(item)}`;
        expect(text, item.q).not.toMatch(pattern);
      }
  });
});
