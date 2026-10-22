import { describe, expect, it } from 'vitest';
import { shapeAt } from './__fixtures__/build';
import { stateAttributeOf } from './state-attribute';

const state = (kind: Parameters<typeof shapeAt>[0], extra: Record<string, unknown> = {}) =>
  stateAttributeOf({ ...shapeAt(kind, 'x', 0, 0), ...extra })
    .map((a) => a.text)
    .join(' ');

describe('stateAttributeOf (R14, VW22)', () => {
  it('counts a temperature check', () => {
    expect(state('temperature', { responses: [{}] })).toBe('votes=1');
  });

  it('names a decision and a pick only when set', () => {
    expect(state('decision', { decisionStatus: 'accepted' })).toBe('status=accepted');
    expect(state('decision', { decisionStatus: undefined })).toBe('');
    expect(state('picker', { pickerResult: 'Sam Lee' })).toBe('picked="Sam Lee"');
    expect(state('picker', { pickerResult: undefined })).toBe('');
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
    // A Timeline counts its milestones (docs/specs/009-elements/concept-graphics.md "Timeline").
    expect(state('timeline-rail', {})).toBe('milestones=4');
    expect(state('timeline-rail', { conceptRows: [{ label: 'A' }, { label: 'B' }] })).toBe(
      'milestones=2',
    );
  });

  it('titles a page, cut like a note', () => {
    expect(
      state('page', {
        pageTitle: 'Quarterly review of the checkout platform and its many services',
      }),
    ).toBe('title="Quarterly review of the checkout platform and"…');
    expect(state('page', { pageTitle: ' ' })).toBe('');
  });

  it('titles a card, and flags a badge or step that is attached to a node', () => {
    expect(state('card', { pageTitle: 'Orders service' })).toBe('title="Orders service"');
    expect(state('card', { pageTitle: undefined })).toBe('');
    expect(state('step', { attachedTo: 'host' })).toBe('attached');
    expect(state('badge', { attachedTo: 'host' })).toBe('attached');
    expect(state('badge')).toBe('');
  });

  it('gives every other kind none', () => {
    expect(state('square')).toBe('');
  });

  it('says what a session button starts', () => {
    expect(state('session-button', { session: { tool: 'timer', minutes: 10 } })).toBe(
      'session=timer:10m',
    );
    expect(state('session-button', { session: { tool: 'vote', dots: 3 } })).toBe('session=vote:3');
    expect(state('session-button', { session: { tool: 'stopwatch' } })).toBe('session=stopwatch');
  });
});
