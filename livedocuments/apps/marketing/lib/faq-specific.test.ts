import { describe, expect, it } from 'vitest';

import { FAQ_CATEGORIES, faqAnswerText } from './faq-content';

// The FAQ is about livedocuments only (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"). It began
// as a copy of livediagram's, so this guard keeps the other apps' names and kinds of work from coming back. Another
// product may be named only in an answer about a real integration, listed here by its question: the account,
// teams and API tokens livedocuments shares with every liveworkspace app.
const INTEGRATION_ANSWERS = new Set([
  'Can I set up a team with shared documents?',
  'Is there an API?',
]);

const OTHER_PRODUCTS = /\b(?:livediagram|liveplanner|livedesign|liveworkspace)\b/i;

// Each other app's signature kinds of work, as its own specs and copy name them. Nouns livedocuments also uses
// (tables, charts, sticky notes, an openly licensed photo) are left out on purpose.
const OTHER_KINDS_OF_WORK: { app: string; pattern: RegExp }[] = [
  {
    app: 'livediagram',
    pattern:
      /\b(?:diagrams?|diagramming|flowcharts?|whiteboards?|mind ?maps?|workshops?|draw mode|start drawing)\b|\bCommunity\b/i,
  },
  {
    app: 'liveplanner',
    pattern:
      /\b(?:boards?|kanban|sheets?|forms|form builder|gantt|backlogs?|sprints?|card types?)\b/i,
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

describe('FAQ is about livedocuments only', () => {
  it.each(entries)('$where names no other product outside an integration answer', ({ text, q }) => {
    if (INTEGRATION_ANSWERS.has(q)) return;
    expect(text).not.toMatch(OTHER_PRODUCTS);
  });

  it.each(entries)("$where names no other app's kinds of work", ({ text }) => {
    for (const { app, pattern } of OTHER_KINDS_OF_WORK) expect(text, app).not.toMatch(pattern);
  });

  it('lists only integration answers that exist and name the shared account', () => {
    const byQuestion = new Map(entries.map((e) => [e.q, e.text]));
    for (const q of INTEGRATION_ANSWERS) {
      expect(byQuestion.get(q), q).toMatch(/liveworkspace account/);
    }
  });

  it('catches a copied livediagram answer', () => {
    const copied = 'Yes. Draw flowcharts on the canvas and share them to the Community.';
    expect(OTHER_KINDS_OF_WORK.some(({ pattern }) => pattern.test(copied))).toBe(true);
  });
});
