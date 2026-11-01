import { describe, expect, it } from 'vitest';

import { faqAnswerText } from '@liveworkspace/marketing-site/lib/faq';

import { FAQ_CATEGORIES } from './faq-content';

// The FAQ answers questions about livediagram alone (docs/specs/019-marketing/marketing-site.md "Content pages
// (FAQ)"). Its sister apps' names and the kinds of work that live there (liveplanner's boards of cards, sheets,
// dashboards and forms; livedocuments' articles, slide pages and infographics; livedesign's logos, wireframes and
// photo pages) must not leak in. An answer about a genuine integration may name them only when its question is
// listed in INTEGRATION_ANSWERS.
const OTHER_PRODUCTS: readonly RegExp[] = [
  /\blive(planner|documents|design|pages)\b/i,
  // liveplanner
  /\bplan mode\b/i,
  /\b(board|sheet|dashboard|form) tabs?\b/i,
  /\bcard types?\b/i,
  /\bspreadsheets\b/i,
  /\bsheet functions?\b/i,
  /\bdashboards\b/i,
  /\bforms\b/i,
  // livedocuments
  /\bpages mode\b/i,
  /\barticles\b/i,
  /\bslide pages?\b/i,
  /\binfographics?\b/i,
  // livedesign
  /\blogos?\b/i,
  /\blogo kit\b/i,
  /\bartboards?\b/i,
  /\bwireframes?\b/i,
  /\bphoto pages?\b/i,
  /\bPSD\b/,
];

// Questions whose answers may name a sister app, because the two genuinely work together.
const INTEGRATION_ANSWERS: ReadonlySet<string> = new Set([]);

const entries = FAQ_CATEGORIES.flatMap((c) =>
  c.items.map((item) => ({
    q: item.q,
    text: [c.title, c.blurb, item.q, faqAnswerText(item)].join(' '),
  })),
);

describe('FAQ scope', () => {
  it.each(entries)('$q stays about livediagram', ({ q, text }) => {
    if (INTEGRATION_ANSWERS.has(q)) return;
    for (const pattern of OTHER_PRODUCTS)
      expect(text, `${q} matches ${pattern}`).not.toMatch(pattern);
  });

  it('only allow-lists questions the FAQ still asks', () => {
    const asked = new Set(entries.map((e) => e.q));
    for (const q of INTEGRATION_ANSWERS) expect(asked.has(q), q).toBe(true);
  });
});
