import { describe, expect, it } from 'vitest';
import { opensForTypingOnPlace } from './placed-kinds';

// docs/specs/009-elements/office.md "Placing selects every piece": only a text-first element opens for typing as it
// lands, never a placed piece (QA 2026-11-27: a stray "r" after placing a Chair became its label).
describe('opensForTypingOnPlace', () => {
  it('opens a sticky, a text and a Room (its name) for typing', () => {
    expect(opensForTypingOnPlace({ type: 'sticky' })).toBe(true);
    expect(opensForTypingOnPlace({ type: 'text' })).toBe(true);
    expect(opensForTypingOnPlace({ type: 'shape', shape: 'room' })).toBe(true);
  });

  it('never opens a seat or a placed piece', () => {
    for (const shape of [
      'chair',
      'sofa',
      'bar-stool',
      'plant',
      'bookshelf',
      'water-cooler',
      'avatar-pad',
    ])
      expect(opensForTypingOnPlace({ type: 'shape', shape }), shape).toBe(false);
  });

  it('never opens what takes no typed label at all (an arrow, a sticker)', () => {
    expect(opensForTypingOnPlace({ type: 'arrow' })).toBe(false);
    expect(opensForTypingOnPlace({ type: 'shape', shape: 'sticker' })).toBe(false);
  });
});
