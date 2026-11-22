import { describe, expect, it } from 'vitest';

import { faqAnswerText } from '@liveworkspace/marketing-site/lib/faq';

import { FAQ_CATEGORIES } from './faq-content';

// The FAQ is about liveknowledge only (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"). It began
// as a copy of another app's, so this guard keeps the other apps' names and kinds of work from coming back. Another
// product may be named only in an answer about what liveknowledge really shares with it, listed here by its
// question with the words that say what is shared.
const INTEGRATION_ANSWERS = new Map<string, RegExp>([
  ['What is liveknowledge?', /part of liveworkspace/],
  ['What is liveknowledge not?', /use livedocuments/],
  ['How is a knowledgebase shared?', /Like every liveworkspace item/],
  ['Can I restrict a single page?', /every liveworkspace app/],
  ['What is tracked?', /liveworkspace’s own telemetry service/],
]);

const OTHER_PRODUCTS =
  /\b(?:livediagram|liveplanner|livedocuments|livedesign|livehuddle|liveworkspace)\b/i;

// Each other app's signature kinds of work, as its own specs and copy name them.
const OTHER_KINDS_OF_WORK: { app: string; pattern: RegExp }[] = [
  {
    app: 'livediagram',
    pattern: /\b(?:flowcharts?|whiteboards?|mind ?maps?|workshops?|draw mode|start drawing)\b/i,
  },
  {
    app: 'liveplanner',
    pattern: /\b(?:kanban|sheets?|forms|form builder|gantt|backlogs?|sprints?|card types?)\b/i,
  },
  {
    app: 'livedesign',
    pattern: /\b(?:logos?|logo kit|wireframes?|artboards?|photo edit(?:s|ing|or)?|PSD|mockups?)\b/i,
  },
];

const entries = FAQ_CATEGORIES.flatMap((c) => [
  { where: `category ${c.id}`, text: `${c.title} ${c.blurb}`, q: '' },
  ...c.items.map((i) => ({ where: i.q, text: `${i.q} ${faqAnswerText(i)}`, q: i.q })),
]);

describe('FAQ is about liveknowledge only', () => {
  it.each(entries)('$where names no other product outside an integration answer', ({ text, q }) => {
    if (INTEGRATION_ANSWERS.has(q)) return;
    expect(text).not.toMatch(OTHER_PRODUCTS);
  });

  it.each(entries)("$where names no other app's kinds of work", ({ text }) => {
    for (const { app, pattern } of OTHER_KINDS_OF_WORK) expect(text, app).not.toMatch(pattern);
  });

  it('lists only integration answers that exist and name what they share', () => {
    const byQuestion = new Map(entries.map((e) => [e.q, e.text]));
    for (const [q, shared] of INTEGRATION_ANSWERS) {
      expect(byQuestion.get(q), q).toMatch(shared);
    }
  });

  it('catches a copied livediagram answer', () => {
    const copied = 'Yes. Draw flowcharts on the canvas and share them with your team.';
    expect(OTHER_KINDS_OF_WORK.some(({ pattern }) => pattern.test(copied))).toBe(true);
  });
});
