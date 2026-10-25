import { describe, expect, it } from 'vitest';

import { faqAnswerText } from '@liveworkspace/marketing-site/lib/faq';

import { FAQ_CATEGORIES } from './faq-content';

// The FAQ is about livedesign only (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"). Much of
// it began as a copy of livediagram's, so this guard keeps the other liveworkspace products, and the kinds of
// work only they make, out of every question, answer, category title and blurb. livedesign's own words stay
// allowed: pages, tabs, the canvas, stickies, cards in the Explorer, the Slide Deck mode and spreadsheets you
// paste from are all livedesign's.
const OTHER_PRODUCTS: { name: string; pattern: RegExp }[] = [
  { name: 'livediagram', pattern: /\blivediagram\b/i },
  { name: 'liveplanner', pattern: /\bliveplanner\b/i },
  { name: 'livedocuments', pattern: /\blive(?:doc(?:ument)?s|pages)\b/i },
  { name: 'liveworkspace', pattern: /\bliveworkspace\b/i },
  // livediagram's kinds of work and features.
  { name: 'diagrams', pattern: /\bdiagram(?:s|ming)?\b/i },
  { name: 'flowcharts', pattern: /\bflow ?charts?\b/i },
  { name: 'mind maps', pattern: /\bmind ?maps?\b/i },
  { name: 'whiteboards', pattern: /\bwhiteboards?\b/i },
  { name: 'swimlanes', pattern: /\bswim ?lanes?\b/i },
  { name: 'Workshop mode', pattern: /\bWorkshop\b/ },
  { name: 'Draw mode', pattern: /\bDraw mode\b/i },
  { name: 'the Community', pattern: /\bCommunity\b/ },
  // liveplanner's.
  { name: 'boards', pattern: /\b(?:kanban|boards?)\b/i },
  { name: 'sheets', pattern: /\bsheets?\b/i },
  // A form people fill in, not livedesign's own contact form.
  { name: 'forms', pattern: /\b(?<!contact )forms?\b/i },
  { name: 'planning', pattern: /\b(?:gantt|sprints?|backlogs?)\b/i },
  // livedocuments'.
  { name: 'articles', pattern: /\barticles?\b/i },
  { name: 'infographics', pattern: /\binfographics?\b/i },
];

// The answers that may name another product, because livedesign genuinely integrates with it there. Keyed by
// the question, each naming only the products it may mention. The answer stays about livedesign.
const INTEGRATIONS: Record<string, string[]> = {
  // Signing in is a liveworkspace account, shared with the other liveworkspace apps.
  'Do I need an account to use livedesign?': ['liveworkspace'],
};

const entries = FAQ_CATEGORIES.flatMap((c) => [
  { where: `category ${c.id}`, q: '', text: `${c.title} ${c.blurb}` },
  ...c.items.map((i) => ({ where: i.q, q: i.q, text: `${i.q} ${faqAnswerText(i)}` })),
]);

describe('FAQ stays about livedesign', () => {
  it.each(entries)('$where names no other product or its kinds of work', ({ q, text }) => {
    const allowed = INTEGRATIONS[q] ?? [];
    const named = OTHER_PRODUCTS.filter(
      ({ name, pattern }) => !allowed.includes(name) && pattern.test(text),
    ).map(({ name }) => name);
    expect(named).toEqual([]);
  });

  it('allow-lists only questions the FAQ asks', () => {
    const asked = new Set(entries.map((e) => e.q));
    for (const q of Object.keys(INTEGRATIONS)) expect(asked.has(q), q).toBe(true);
  });
});
