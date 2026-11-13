import { describe, expect, it } from 'vitest';
import { drawnCount, drawnCountWithForm } from './drawn-count';

// docs/specs/006-document/document-snapshots.md "An empty document is never asked for".

describe('drawnCount', () => {
  it('counts the elements', () => {
    expect(drawnCount({ elements: [] })).toBe(0);
    expect(drawnCount({ elements: [{}, {}] })).toBe(2);
  });

  it('reads anything else as nothing to draw', () => {
    expect(drawnCount({})).toBe(0);
    expect(drawnCount({ elements: 'x' })).toBe(0);
  });
});

describe('drawnCountWithForm', () => {
  it('counts the elements, and a form as one more', () => {
    expect(drawnCountWithForm({ elements: [] })).toBe(0);
    expect(drawnCountWithForm({ elements: [{}, {}] })).toBe(2);
    expect(drawnCountWithForm({ elements: [], form: { v: 1, heading: 'F', sections: [] } })).toBe(1);
    expect(drawnCountWithForm({ elements: [{}], form: { v: 1 } })).toBe(2);
  });

  it('reads anything else as nothing to draw', () => {
    expect(drawnCountWithForm({})).toBe(0);
    expect(drawnCountWithForm({ elements: 'x', form: null })).toBe(0);
    expect(drawnCountWithForm({ elements: [], form: [] })).toBe(0);
    expect(drawnCountWithForm({ elements: [], form: 'form' })).toBe(0);
  });
});
