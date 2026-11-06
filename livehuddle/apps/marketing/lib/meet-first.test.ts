import { describe, expect, it } from 'vitest';

import { faqAnswerText } from '@liveworkspace/marketing-site/lib/faq';

import { COMPARISONS } from './alternatives';
import { FAQ_CATEGORIES } from './faq-content';
import { LANDING_SECTIONS } from './landing-content';

// livehuddle is for meeting in Spaces (docs/specs/001-project-vision/purpose.md, Work Tracker #423): workshops,
// retros, polls, Q&A, quizzes, decks, diagrams and the pens left it for livediagram
// (docs/specs/002-project-scope/not-in-livehuddle.md). Marketing copy that still offers one breaks the golden rule
// (docs/specs/019-marketing/marketing-site.md), so this reads every page's words and fails on a retired one.
const RETIRED =
  /\b(workshops?|retros?|retrospectives?|polls?|Q&A|quiz(zes)?|decks?|slides?|diagrams?|flowcharts?|mind ?maps?|brainstorm\w*|agendas?|lean coffee|planning poker|pencil|highlighter)\b/i;

// A sentence that legitimately names a retired thing, because it points the reader elsewhere (say, "Running a
// workshop? livediagram's Workshop mode has every tool for it."). Exact sentences, kept short; prefer rewording.
const ALLOWED: ReadonlySet<string> = new Set([]);

const copy: { where: string; text: string }[] = [
  { where: 'alternatives', text: JSON.stringify(COMPARISONS) },
  ...FAQ_CATEGORIES.flatMap((c) =>
    c.items.map((i) => ({
      where: `faq: ${i.q}`,
      text: `${c.title}. ${c.blurb} ${i.q} ${faqAnswerText(i)}`,
    })),
  ),
  ...LANDING_SECTIONS.map((s) => ({
    where: `landing/${s.id}`,
    text: [s.label, s.title, s.description, s.metaDescription, s.cta].join('. '),
  })),
  ...LANDING_SECTIONS.flatMap((s) =>
    s.items.map((i) => ({
      where: `landing/${s.id}: ${i.title}`,
      text: `${i.title}. ${i.description}`,
    })),
  ),
];

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|"\s*[,:{}[\]]\s*"/);

describe('meet-first marketing copy', () => {
  it('reads every page it guards', () => {
    expect(copy.length).toBeGreaterThan(50);
  });

  it('offers nothing that left livehuddle', () => {
    const hits = copy.flatMap(({ where, text }) =>
      sentences(text)
        .filter((sentence) => RETIRED.test(sentence) && !ALLOWED.has(sentence.trim()))
        .map((sentence) => `${where}: ${sentence.trim().slice(0, 120)}`),
    );
    expect(hits).toEqual([]);
  });

  it('only allow-lists sentences the copy still has', () => {
    const all = copy.map((c) => c.text).join('\n');
    for (const sentence of ALLOWED) expect(all, sentence).toContain(sentence);
  });
});
