import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import { TRASH_STATUS } from './board';
import { labelUsage, matchLabels, planSpellingOf } from './label-usage';

// docs/specs/026-plan/plan-board.md "Working on a board": the label menu.
const card = (labels: unknown, status = 'todo'): Item =>
  ({ id: 'x', key: 1, type: 'task', fields: { title: 't', status, labels } }) as unknown as Item;

describe('labelUsage', () => {
  it('counts each label once per card, most used first then A to Z', () => {
    const uses = labelUsage([
      card(['seo', 'Copy']),
      card(['seo', 'seo', 'api']),
      card(['copy', 'Api']),
      card(undefined),
    ]);
    expect(uses).toEqual([
      { label: 'seo', count: 2 },
      { label: 'Api', count: 1 },
      { label: 'api', count: 1 },
      { label: 'Copy', count: 1 },
      { label: 'copy', count: 1 },
    ]);
  });

  it('forgets a label once no card outside the Trash carries it', () => {
    expect(labelUsage([card(['old'], TRASH_STATUS), card(['live'])])).toEqual([
      { label: 'live', count: 1 },
    ]);
    expect(labelUsage([])).toEqual([]);
  });

  it('counts a plan of 2,000 cards of 12 labels well within a frame', () => {
    const cards = Array.from({ length: 2000 }, (_, i) =>
      card(Array.from({ length: 12 }, (_, j) => `label-${(i * 7 + j) % 300}`)),
    );
    // Generous against a busy machine (suggested-statuses.test.ts's budget): it measures a few milliseconds.
    const t0 = performance.now();
    const uses = labelUsage(cards);
    expect(performance.now() - t0).toBeLessThan(250);
    expect(uses).toHaveLength(300);
  });
});

describe('planSpellingOf', () => {
  const uses = [
    { label: 'Bug', count: 3 },
    { label: 'bug', count: 1 },
  ];
  it('takes the plan’s most used spelling, case aside', () => {
    expect(planSpellingOf('BUG', uses)).toBe('Bug');
    expect(planSpellingOf('new', uses)).toBe('new');
  });
});

describe('matchLabels', () => {
  const uses = [
    { label: 'frontend', count: 5 },
    { label: 'api', count: 4 },
    { label: 'Front door', count: 2 },
    { label: 'storefront', count: 1 },
  ];
  it('offers every label the card lacks before anything is typed', () => {
    expect(matchLabels(uses, ' ', ['API'])).toEqual({
      matches: [uses[0], uses[2], uses[3]],
      creatable: false,
    });
  });

  it('puts labels starting with the text before those containing it, case aside', () => {
    expect(matchLabels(uses, 'FRONT', [])).toEqual({
      matches: [uses[0], uses[2], uses[3]],
      creatable: true,
    });
    expect(matchLabels(uses, '#zz', [])).toEqual({ matches: [], creatable: true });
  });

  it('creates nothing a plan label or the card already spells', () => {
    expect(matchLabels(uses, 'Api', []).creatable).toBe(false);
    expect(matchLabels(uses, 'mine', ['Mine'])).toEqual({ matches: [], creatable: false });
  });
});
