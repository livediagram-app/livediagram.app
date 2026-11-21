// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SETUP_STRUCTURES, STRUCTURE_GROUPS } from '@liveknowledge/knowledge';
import { faqAnswerText, filterFaq } from '@liveworkspace/marketing-site/lib/faq';
import {
  FAQ_CATEGORIES,
  LANDING_FAQ,
  LANDING_FAQ_COUNT,
  STRUCTURE_COUNT_WORD,
  STRUCTURE_GROUP_NAMES,
} from './faq-content';

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

  it('never uses an em dash', () => {
    for (const item of items) expect(`${item.q} ${faqAnswerText(item)}`, item.q).not.toMatch(/—/);
  });

  it('names the structure groups and counts the structures the templates are', () => {
    expect(STRUCTURE_GROUP_NAMES).toEqual(STRUCTURE_GROUPS.map((g) => g.name));
    expect(STRUCTURE_COUNT_WORD).toBe('sixteen');
    expect(SETUP_STRUCTURES).toHaveLength(16);
    for (const name of [
      'Team Handbook',
      'Engineering Handbook',
      'Runbooks and On-Call',
      'Sales Playbook',
    ])
      expect(SETUP_STRUCTURES.map((s) => s.name)).toContain(name);
  });

  it('is searchable by a word in an answer', () => {
    expect(filterFaq(FAQ_CATEGORIES, 'confluence').flatMap((c) => c.items).length).toBeGreaterThan(
      0,
    );
    expect(filterFaq(FAQ_CATEGORIES, 'zzzz')).toEqual([]);
  });
});

// docs/specs/019-marketing/marketing-site.md "Structure" 9 and the honest answers the page owes a visitor.
describe('the landing FAQ', () => {
  it('finds every question it means to show', () => {
    expect(LANDING_FAQ).toHaveLength(LANDING_FAQ_COUNT);
    expect(LANDING_FAQ_COUNT).toBe(8);
  });

  const answer = (q: string) => faqAnswerText(items.find((i) => i.q === q)!);

  it('says it is free to start and MIT, and promises nothing about tiers', () => {
    expect(answer('Is liveknowledge free?')).toMatch(/free to start.*MIT licence/);
    expect(answer('Is liveknowledge free?')).not.toMatch(/no paid tier|forever/i);
  });

  it('says the team pays for Ask on its own key, and that the rest needs none', () => {
    expect(answer('Who pays for Ask?')).toMatch(/own Claude or OpenAI key/);
    expect(answer('Who pays for Ask?')).toMatch(/need no key/);
  });

  it('says an agent sees only what its person or token can open', () => {
    expect(answer('What can an agent see?')).toMatch(/Only what the person or token/);
  });

  it('says Google Docs import is not built', () => {
    expect(answer('Can I import from Notion and Confluence?')).toMatch(
      /Google Docs import is not built/,
    );
  });

  it('says the key is encrypted and never shown again', () => {
    expect(answer('Is my API key safe?')).toMatch(/encrypted.*never sent back/);
  });

  it('says what it is not, and where to go instead', () => {
    expect(answer('What is liveknowledge not?')).toMatch(
      /not a slide or page layout tool.*livedocuments/,
    );
  });
});
