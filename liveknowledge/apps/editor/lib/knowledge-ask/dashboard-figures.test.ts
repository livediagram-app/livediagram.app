// Insights' figures and Needs Attention's order (docs/specs/030-knowledgebase/blueprints/insights-ui.md
// "The dashboard").
import { describe, expect, it } from 'vitest';
import type { KnowledgeConflict, KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import {
  attentionItems,
  dashboardFigures,
  readersText,
  readsSparkLabel,
} from './dashboard-figures';

const side = {
  passageId: 'x',
  tab: 't',
  firstBlock: 'b',
  title: 'T',
  text: 'x',
  trust: 'verified' as const,
};
const conflict = (id: string, foundAt: number): KnowledgeConflict => ({
  id,
  question: id,
  a: side,
  b: side,
  foundAt,
});
const base: KnowledgeOverviewResponse = {
  agents: [],
  questions: [
    { key: 'a', question: 'a', asked: 2, byPeople: 2, agents: [], lastAt: 1 },
    { key: 'b', question: 'b', asked: 5, byPeople: 5, agents: [], lastAt: 1 },
    { key: 'c', question: 'c', asked: 2, byPeople: 2, agents: [], lastAt: 9 },
  ],
  conflicts: [conflict('old', 1), conflict('new', 2)],
  suggestions: [],
  context: { budget: 8000, used: 0, pages: [] },
  health: { verified: 199, reviewDue: 0, neverVerified: 1, total: 200 },
  reviewEvery: 90,
  hasKey: true,
  hasAi: true,
  reviewEmails: { available: false },
  reads: { days: [], mostRead: [] },
};

describe('dashboardFigures', () => {
  it('never rounds one page unverified up to 100%, and has no share without pages', () => {
    expect(dashboardFigures(base).verifiedShare).toBe(99);
    expect(
      dashboardFigures({
        ...base,
        health: { verified: 0, reviewDue: 0, neverVerified: 0, total: 0 },
      }).verifiedShare,
    ).toBeNull();
  });

  it('counts the week from the last seven days and every ask', () => {
    const days = Array.from({ length: 14 }, (_, at) => ({ day: `d${at}`, people: 1, agents: 2 }));
    const figures = dashboardFigures({ ...base, reads: { days, mostRead: [] } });
    expect(figures.readsWeek).toEqual({ people: 7, agents: 14, total: 21 });
    expect(figures.asks).toBe(9);
    expect(figures.conflicts).toBe(2);
  });
});

describe('attentionItems', () => {
  it('puts conflicts first, newest first, then questions by asks and then by when', () => {
    expect(attentionItems(base, 'all').map((item) => item.id)).toEqual([
      'conflict:new',
      'conflict:old',
      'question:b',
      'question:c',
      'question:a',
    ]);
    expect(attentionItems(base, 'suggestions')).toEqual([]);
    expect(attentionItems(base, 'conflicts')).toHaveLength(2);
  });
});

describe('words', () => {
  it('says reads, people and agents apart, and the sparkline', () => {
    expect(readersText(1, 1)).toBe('1 read by people, 1 by agents');
    expect(readersText(1200, 0)).toBe('1,200 reads by people, 0 by agents');
    expect(readsSparkLabel([{ day: 'd', people: 3, agents: 1 }])).toBe(
      'Reads by day over the last 1 days: 3 by people, 1 by agents.',
    );
  });
});
