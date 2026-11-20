import { describe, expect, it } from 'vitest';

import { faqAnswerText } from '@liveworkspace/marketing-site/lib/faq';
import { COMPARISONS } from './alternatives';
import { FAQ_CATEGORIES } from './faq-content';
import { LANDING_SECTIONS } from './landing-content';
import { PROMISES } from './promises';
import { HERO_HEADLINE, PITCH_LINE, SITE_DESCRIPTION, SITE_TITLE } from './site-words';

// What the site may never claim (docs/specs/019-marketing/marketing-site.md "Golden rule" and "The pitch"). Each
// rule here is either a feature the fork brought and liveknowledge cut
// (docs/specs/002-project-scope/not-in-liveknowledge.md), something v1 leaves for later, or the product's own
// name. The guard reads the landing copy, the FAQ and every comparison, so one cannot come back on any page.

// A string of copy, and where it is, so a failure names the sentence's home.
type Copy = { where: string; text: string };

const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

const landing: Copy[] = [
  {
    where: 'site words',
    text: [SITE_TITLE, SITE_DESCRIPTION, PITCH_LINE, HERO_HEADLINE].join(' '),
  },
  ...LANDING_SECTIONS.map((s) => ({
    where: `landing/${s.id}`,
    text: [s.label, s.title, s.description, ...s.points].join(' '),
  })),
  ...PROMISES.map((p) => ({ where: `promise/${p.id}`, text: `${p.title} ${p.line}` })),
];
const faq: Copy[] = FAQ_CATEGORIES.flatMap((c) => [
  { where: `faq category ${c.id}`, text: `${c.title} ${c.blurb}` },
  ...c.items.map((i) => ({ where: `faq: ${i.q}`, text: `${i.q} ${faqAnswerText(i)}` })),
]);
// A comparison's every string on its own, so a rule can tell our cell from theirs.
const comparisons: Copy[] = [
  ...strings(COMPARISONS.hub).map((text) => ({ where: 'alternatives hub', text })),
  ...COMPARISONS.alternatives.flatMap((a) =>
    strings(a).map((text) => ({ where: `alternatives/${a.slug}`, text })),
  ),
];
const copy = [...landing, ...faq, ...comparisons];

// The one sentence that may name what the fork brought: it says liveknowledge is NOT that, and where to go.
const WHAT_IT_IS_NOT = 'faq: What is liveknowledge not?';

const CUT_FROM_FORK: { pattern: RegExp; why: string }[] = [
  { pattern: /\bslides?\b|\bslide decks?\b|\bdecks?\b/i, why: 'slides were cut from the fork' },
  {
    pattern: /infographic|flashcard|\bposters?\b/i,
    why: 'infographics, flashcards and posters were cut',
  },
  { pattern: /powerpoint|\.pptx|\bpptx\b/i, why: 'PowerPoint import and export were cut' },
  { pattern: /page layouts?|slide layouts?/i, why: 'page layouts were cut' },
  { pattern: /\bpresent(?:ing|er|ation)?\b|speaker notes/i, why: 'presenting was cut' },
  {
    pattern: /paper sizes?|\bA4\b|US Letter|landscape|portrait/i,
    why: 'paper sizes are not a choice',
  },
  { pattern: /\bGIF\b/i, why: 'animated GIF export was cut' },
];

const NOT_BUILT: { pattern: RegExp; why: string }[] = [
  {
    pattern: /imports? (?:from )?google docs|google docs import(?! is not built)/i,
    why: 'Google Docs import is not built (not-in-liveknowledge.md "Not in v1")',
  },
  {
    pattern: /reminder emails?\b(?! are not built)|emails? (?:you|owners?|them) when/i,
    why: 'review reminder emails are not built (verification.md)',
  },
  {
    pattern: /(?<!No )semantic search\b(?! is not built)|understands meaning/i,
    why: 'search is keyword search (search-and-ask.md)',
  },
  {
    pattern: /free forever|forever free/i,
    why: 'the site says free to start and promises nothing about price',
  },
  {
    pattern: /no paid tier|no plan for one|free for everyone|every feature included/i,
    why: 'the site makes no promise about tiers (owner, 2026-11-20)',
  },
];

describe('product claims in marketing copy', () => {
  it('reads every page it guards', () => {
    expect(landing.length).toBeGreaterThan(8);
    expect(faq.length).toBeGreaterThan(25);
    expect(comparisons.length).toBeGreaterThan(200);
  });

  for (const { pattern, why } of CUT_FROM_FORK) {
    it(`never sells ${pattern.source}: ${why}`, () => {
      const hits = copy
        .filter((c) => c.where !== WHAT_IT_IS_NOT && pattern.test(c.text))
        .map((c) => `${c.where}: ${c.text.slice(0, 70)}`);
      expect(hits).toEqual([]);
    });
  }

  it('names what it is not exactly once, and sends that reader to livedocuments', () => {
    const not = faq.find((c) => c.where === WHAT_IT_IS_NOT)!;
    expect(not.text).toMatch(/not a slide or page layout tool/);
    expect(not.text).toMatch(/livedocuments/);
  });

  // Our own copy never claims these. A comparison may say a competitor has one ("search that understands
  // meaning"), so there only the cells and prose about us are held: the row's `us` and the usBest list.
  const ours: Copy[] = [
    ...landing,
    ...faq,
    ...COMPARISONS.alternatives.flatMap((a) => [
      ...a.rows.map((r) => ({ where: `alternatives/${a.slug} row ${r.label}`, text: r.us })),
      ...a.usBest.map((text) => ({ where: `alternatives/${a.slug} usBest`, text })),
    ]),
  ];
  for (const { pattern, why } of NOT_BUILT) {
    it(`never claims ${pattern.source}: ${why}`, () => {
      const hits = ours.filter((c) => pattern.test(c.text)).map((c) => `${c.where}: ${c.text}`);
      expect(hits).toEqual([]);
    });
  }
});

// docs/specs/019-marketing/marketing-site.md "The pitch".
describe('the product’s name for itself', () => {
  it('is never "knowledge base" as two words, anywhere', () => {
    const hits = copy.filter((c) => /knowledge base/i.test(c.text)).map((c) => c.where);
    expect(hits).toEqual([]);
  });

  it('is never "wiki", except where a comparison names the wiki category', () => {
    const hits = [...landing, ...faq].filter((c) => /wiki/i.test(c.text)).map((c) => c.where);
    expect(hits).toEqual([]);
    // In a comparison, "wiki" is always the other tool's, or the category: never "liveknowledge is a wiki".
    for (const c of comparisons) {
      expect(c.text, c.where).not.toMatch(
        /liveknowledge(?:’s)? (?:is (?:a|your) )?(?:team )?wiki/i,
      );
    }
  });

  it('never uses an em dash, or stock AI phrasing', () => {
    for (const c of copy) {
      expect(c.text, c.where).not.toMatch(/—/);
      expect(c.text, c.where).not.toMatch(/supercharge|unlock|seamless|effortless|game.chang/i);
    }
  });
});
