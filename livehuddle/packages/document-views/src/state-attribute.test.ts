import { describe, expect, it } from 'vitest';
import { shapeAt } from './__fixtures__/build';
import { stateAttributeOf } from './state-attribute';

const state = (kind: Parameters<typeof shapeAt>[0], extra: Record<string, unknown> = {}) =>
  stateAttributeOf({ ...shapeAt(kind, 'x', 0, 0), ...extra })
    .map((a) => a.text)
    .join(' ');

describe('stateAttributeOf (R14, VW22)', () => {
  it("counts a Timeline's milestones", () => {
    // A Timeline counts its milestones (docs/specs/009-elements/timeline.md "Timeline").
    expect(state('timeline-rail', {})).toBe('milestones=4');
    expect(state('timeline-rail', { conceptRows: [{ label: 'A' }, { label: 'B' }] })).toBe(
      'milestones=2',
    );
  });

  it('titles a card, cut like a note', () => {
    expect(
      state('card', {
        pageTitle: 'Quarterly review of the checkout platform and its many services',
      }),
    ).toBe('title="Quarterly review of the checkout platform and"…');
    expect(state('card', { pageTitle: ' ' })).toBe('');
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

  // The Collaborate panels are retired (docs/specs/002-project-scope/not-in-livehuddle.md): their stored answers are
  // not read out.
  it('gives a retired element none, whatever it stored', () => {
    expect(state('square', { shape: 'estimate', responses: [{}], responsesRevealed: true })).toBe(
      '',
    );
    expect(state('square', { shape: 'session-button', session: { tool: 'timer' } })).toBe('');
    expect(state('square', { shape: 'qa-board', qaNotes: [{}] })).toBe('');
    // And the diagram tools Work Tracker #459 deleted.
    expect(state('square', { shape: 'stat-row', stats: [{}, {}] })).toBe('');
    expect(state('square', { shape: 'rating', rating: 4 })).toBe('');
    expect(state('square', { shape: 'progress-bar', progress: 40 })).toBe('');
    expect(state('square', { shape: 'page', pageTitle: 'Quarterly review' })).toBe('');
  });
});
