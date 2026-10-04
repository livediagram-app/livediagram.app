import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { shapeAt } from './__fixtures__/build';
import { stateAttributeOf } from './state-attribute';

const state = (kind: Parameters<typeof shapeAt>[0], extra: Record<string, unknown> = {}) =>
  stateAttributeOf({ ...shapeAt(kind, 'x', 0, 0), ...extra } as Element)
    .map((a) => a.text)
    .join(' ');

describe('stateAttributeOf (R14, VW22)', () => {
  it('counts the collaboration family', () => {
    expect(state('estimate', { responses: [{}, {}], responsesRevealed: true })).toBe(
      'votes=2 revealed',
    );
    expect(state('estimate', { responses: [] })).toBe('votes=0');
    expect(state('temperature', { responses: [{}] })).toBe('votes=1');
    expect(state('done-check', { responses: [{}, {}, {}] })).toBe('done=3');
    expect(state('idea-box', { ideaCards: ['a'], ideasRevealed: true })).toBe('ideas=1 revealed');
    expect(state('idea-box', { ideaCards: [] })).toBe('ideas=0');
    expect(state('qa-board', { qaNotes: [{}] })).toBe('questions=1');
    expect(state('roll-call', { rollCall: [{}, {}] })).toBe('present=2');
  });

  it('places an agenda and a quiz', () => {
    expect(state('agenda', { agendaItems: [{}, {}, {}], agendaCurrent: 1 })).toBe('item=2/3');
    expect(state('agenda', { agendaItems: [{}, {}], agendaCurrent: undefined })).toBe('items=2');
    expect(state('quiz', { quizRevealed: true })).toBe('state=revealed');
    expect(state('quiz', { quizLockedAt: 5 })).toBe('state=locked');
    expect(state('quiz', { quizStartedAt: 5 })).toBe('state=open');
    expect(
      state('quiz', { quizStartedAt: undefined, quizLockedAt: undefined, quizRevealed: undefined }),
    ).toBe('state=ready');
  });

  it('names a decision, a pick and a reveal only when set', () => {
    expect(state('decision', { decisionStatus: 'accepted' })).toBe('status=accepted');
    expect(state('decision', { decisionStatus: undefined })).toBe('');
    expect(state('picker', { pickerResult: 'Sam Lee' })).toBe('picked="Sam Lee"');
    expect(state('picker', { pickerResult: undefined })).toBe('');
    expect(state('reveal', { revealed: true })).toBe('revealed');
    expect(state('reveal', { revealed: false })).toBe('');
  });

  it('counts the structured kinds', () => {
    expect(state('stat-row', { stats: [{}, {}] })).toBe('stats=2');
    expect(state('process', { processSteps: ['a'] })).toBe('steps=1');
    expect(state('site-header', { navLinks: ['a', 'b'] })).toBe('links=2');
    expect(state('legend', { legendItems: [{}] })).toBe('items=1');
  });

  it('reads values, falling back to what the editor draws', () => {
    expect(state('rating', { rating: 4 })).toBe('rating=4/5');
    expect(state('rating', { rating: undefined })).toBe('rating=3/5');
    expect(state('progress-bar', { progress: 40 })).toBe('progress=40');
    expect(state('progress-ring', { progress: undefined })).toBe('progress=50');
    expect(state('timeline-rail', { railCount: 5 })).toBe('points=5');
    expect(state('timeline-rail', { railCount: undefined })).toBe('points=3');
  });

  it('titles a page, cut like a note', () => {
    expect(
      state('page', {
        pageTitle: 'Quarterly review of the checkout platform and its many services',
      }),
    ).toBe('title="Quarterly review of the checkout platform and"…');
    expect(state('page', { pageTitle: ' ' })).toBe('');
  });

  it('gives every other kind none', () => {
    expect(state('square')).toBe('');
  });
});
