import { describe, expect, it, vi } from 'vitest';
import { settleStoredArticles, settleStoredArticlesData } from './article-flow';
import { migrateIncomingElements, migrateIncomingTab, migrateStoredTab } from './stored-tab';
import type { Tab } from './index';
import { isKnowledgebasePage } from './knowledgebase-page';
import { pagesOf } from './page';

describe('migrateStoredTab', () => {
  it('returns the same tab when there is nothing to settle', () => {
    const tab: Tab = {
      id: 't',
      name: 'T',
      elements: [{ id: 'a', type: 'sticky', x: 0, y: 0, width: 1, height: 1 }],
    };
    expect(migrateStoredTab(tab)).toBe(tab);
  });

  // docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen": an api-made tab with no page kind opens as
  // an empty article page, never on a start.
  it('reads an empty tab with no page of a kind as an empty knowledgebase page', () => {
    const empty: Tab = { id: 't', name: 'From an Agent', elements: [] };
    const settled = migrateStoredTab(empty);
    expect(isKnowledgebasePage(settled)).toBe(true);
    expect(pagesOf(settled)).toHaveLength(1);
    expect(settled.name).toBe('From an Agent');
    const incoming = migrateIncomingTab({ id: 't', name: 'X', elements: [], pages: [] }) as Tab;
    expect(isKnowledgebasePage(incoming)).toBe(true);
  });
});

// Untrusted input (an api write, a realtime peer, a file, a paste) is migrated BEFORE it is validated, and the
// migrations' settle steps read an element's fields as their types. A malformed element must reach validation as it
// came, to be refused there, never throw: a step chip whose label was a number threw in settleChips, so a tab PUT
// answered 500 and a file import broke instead of being refused.
describe('migrating untrusted input', () => {
  const box = {
    id: 'a',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    label: 'A',
  };
  const badStep = { ...box, id: 's', shape: 'step', label: 5 };

  it('hands a tab that a migration cannot read back as it came', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab = { id: 't', name: 'T', elements: [box, badStep] };
    expect(migrateIncomingTab(tab)).toBe(tab);
    expect(warn).toHaveBeenCalledWith('[migrate] incoming-unreadable', { elements: 2 });
    warn.mockRestore();
  });

  it('hands elements that a migration cannot read back as they came, non-objects dropped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(migrateIncomingElements([box, badStep, 7])).toEqual([box, badStep]);
    warn.mockRestore();
  });

  it('still migrates input it can read', () => {
    const step = { ...badStep, label: '' };
    const [, settled] = migrateIncomingElements([box, step]);
    expect(settled).not.toBe(step);
    expect((settled as { label?: string }).label).toBe('1');
  });
});

// Suggestions are retired (docs/specs/007-editor/suggestions.md "Writing stored with a suggestion"): a stored tab is
// settled so its plain JSON, which a Community visitor and an agent are sent, never carries the suggested words or who
// suggested them (SG1, SG2).
describe('legacy suggestions in stored articles', () => {
  const by = { id: 's1', by: 'user_secret', n: 'Sam Suggester', at: 1 };
  const suggested = {
    blocks: [
      {
        id: 'b1',
        type: 'paragraph',
        runs: [
          { text: 'Kept. ' },
          { text: 'UNACCEPTED', sg: { ...by, k: 'ins' } },
          { text: 'Stays.', sg: { ...by, k: 'del' } },
          { text: 'Plain', bold: true, sg: { ...by, k: 'fmt', was: {} } },
        ],
      },
      { id: 'b2', type: 'paragraph', sg: { ...by, k: 'ins' }, runs: [{ text: ' Joined.' }] },
    ],
  };
  const clean = { blocks: [{ id: 'c1', type: 'paragraph', runs: [{ text: 'Clean' }] }] };
  const tab = { id: 't', name: 'T', elements: [], articles: { f1: suggested, f2: clean } };

  it('reads a stored tab as if every suggestion were rejected, leaving other articles as stored', () => {
    const settled = migrateStoredTab(tab);
    const json = JSON.stringify(settled);
    for (const leaked of ['"sg"', 'UNACCEPTED', 'user_secret', 'Sam Suggester']) {
      expect(json).not.toContain(leaked);
    }
    expect(settled.articles.f1.blocks).toEqual([
      { id: 'b1', type: 'paragraph', runs: [{ text: 'Kept. Stays.Plain Joined.' }] },
    ]);
    expect(settled.articles.f2).toBe(clean);
  });

  it('hands back the same tab when no article holds one, or there are none', () => {
    const plain = { elements: [], articles: { f2: clean } };
    expect(settleStoredArticles(plain)).toBe(plain);
    for (const articles of [undefined, null, 'x', [suggested]]) {
      const odd = { elements: [], articles };
      expect(settleStoredArticles(odd)).toBe(odd);
    }
    const malformed = {
      articles: {
        f: null,
        g: { blocks: 'x' },
        h: { blocks: [null, { runs: 1 }, { runs: [null] }] },
      },
    };
    expect(settleStoredArticles(malformed)).toBe(malformed);
  });

  it('settles stored data JSON, and passes on untouched what names no suggestion or cannot be read', () => {
    const data = JSON.stringify(tab);
    const settled = settleStoredArticlesData(data);
    expect(settled).not.toContain('"sg"');
    expect(settled).not.toContain('UNACCEPTED');
    const plain = JSON.stringify({ elements: [], articles: { f2: clean } });
    expect(settleStoredArticlesData(plain)).toBe(plain);
    // The letters appear, but no article holds a suggestion.
    const named = JSON.stringify({ elements: [{ id: 'a', label: '"sg"' }], sg: 1 });
    expect(settleStoredArticlesData(named)).toBe(named);
    expect(settleStoredArticlesData('"sg"')).toBe('"sg"');
    expect(settleStoredArticlesData('{"sg" broken')).toBe('{"sg" broken');
  });

  it('checks a large tab with nothing to settle within budget', () => {
    const runs = Array.from({ length: 20 }, (_, i) => ({ text: `word ${i} ` }));
    const blocks = Array.from({ length: 2_000 }, (_, i) => ({
      id: `b${i}`,
      type: 'paragraph',
      runs,
    }));
    const big = { elements: [], articles: { f1: { blocks }, f2: { blocks } } };
    const before = process.cpuUsage();
    for (let i = 0; i < 20; i++) expect(settleStoredArticles(big)).toBe(big);
    const { user, system } = process.cpuUsage(before);
    // 80,000 runs a pass; a pass is a few milliseconds. The budget is CPU time, and loose.
    expect((user + system) / 1000 / 20).toBeLessThan(50);
  });
});
