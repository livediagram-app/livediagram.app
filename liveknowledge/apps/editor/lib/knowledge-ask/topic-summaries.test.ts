// The dashboard tiles' words (docs/specs/030-knowledgebase/insights.md "The dashboard").
import { describe, expect, it } from 'vitest';
import type { KnowledgeConflict, KnowledgeSuggestion } from '@liveknowledge/api-schema';
import { attentionLine, attentionPreview, notReadText, requiredText } from './topic-summaries';

const conflict = (id: string, question: string): KnowledgeConflict =>
  ({ id, question, foundAt: 1 }) as KnowledgeConflict;
const suggestion = (over: Partial<KnowledgeSuggestion>): KnowledgeSuggestion =>
  ({
    id: 's',
    tab: 'p',
    title: 'Release',
    reason: 'Why.',
    summary: '',
    createdAt: 1,
    ...over,
  }) as KnowledgeSuggestion;

describe('topic summaries', () => {
  it('says each kind of waiting thing in one line', () => {
    expect(
      attentionLine({ kind: 'conflict', id: 'c', conflict: conflict('c', 'Which day?') }),
    ).toBe('Which day?');
    expect(attentionLine({ kind: 'conflict', id: 'c', conflict: conflict('c', '') })).toBe(
      'Two pages disagree',
    );
    expect(
      attentionLine({
        kind: 'suggestion',
        id: 's',
        suggestion: suggestion({ summary: 'Fix it.' }),
      }),
    ).toBe('Release: Fix it.');
    expect(
      attentionLine({
        kind: 'suggestion',
        id: 's',
        suggestion: suggestion({ title: '', reason: 'First line.\nMore.' }),
      }),
    ).toBe('Untitled Page: First line.');
    expect(
      attentionLine({ kind: 'suggestion', id: 's', suggestion: suggestion({ reason: '' }) }),
    ).toBe('Release');
    expect(
      attentionLine({
        kind: 'question',
        id: 'q',
        question: { key: 'q', question: 'Who?', asked: 1, byPeople: 1, agents: [], lastAt: 1 },
      }),
    ).toBe('Who?');
  });

  it('previews the first three, most urgent first, and counts the rest', () => {
    const conflicts = ['a', 'b', 'c', 'd'].map((id) => conflict(id, id));
    const preview = attentionPreview({ conflicts, suggestions: [], questions: [] });
    expect(preview.rows).toHaveLength(3);
    expect(preview.more).toBe(1);
    expect(attentionPreview({ conflicts: [], suggestions: [], questions: [] })).toEqual({
      rows: [],
      more: 0,
    });
  });

  it('counts in words, and says nothing with none', () => {
    expect(notReadText(undefined, 90)).toBeNull();
    expect(notReadText({ pages: [], total: 0 }, 90)).toBeNull();
    expect(notReadText({ pages: [], total: 1 }, 30)).toBe('1 page not read in 30 days');
    expect(notReadText({ pages: [], total: 4 }, 90)).toBe('4 pages not read in 90 days');
    expect(requiredText(undefined)).toBeNull();
    expect(requiredText([])).toBeNull();
    const page = { tab: 'r', title: 'R', audience: 'everyone' as const, done: 0, total: 1 };
    expect(requiredText([page])).toBe('1 page asked to be read');
    expect(requiredText([page, { ...page, tab: 'r2' }])).toBe('2 pages asked to be read');
  });
});
