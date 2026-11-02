import { describe, expect, it } from 'vitest';
import { sameSitters, sittersByChair } from './chair-sitters';

// docs/specs/008-canvas/avatar-mode.md: who sits in each chair, from presence.

describe('sittersByChair', () => {
  it('lists our own character and every seated peer by chair', () => {
    const map = sittersByChair('c1', '#f00', [
      { name: 'Ann', color: '#0f0', seatedOn: 'c1' },
      { name: 'Bo', color: '#00f', seatedOn: null },
    ]);
    expect(map.get('c1')).toEqual([
      { name: 'You', color: '#f00' },
      { name: 'Ann', color: '#0f0' },
    ]);
    expect(map.size).toBe(1);
  });
});

describe('sameSitters', () => {
  it('is equal when every chair holds the same sitters, however the maps were built', () => {
    expect(sameSitters(sittersByChair(null, '#f00', []), sittersByChair(null, '#0f0', []))).toBe(
      true,
    );
    expect(
      sameSitters(
        sittersByChair('c1', '#f00', []),
        sittersByChair('c1', '#f00', [{ name: 'Ann', color: '#0f0', seatedOn: null }]),
      ),
    ).toBe(true);
  });

  it('differs when a sitter arrives, leaves or changes colour', () => {
    const one = sittersByChair('c1', '#f00', []);
    expect(sameSitters(one, sittersByChair(null, '#f00', []))).toBe(false);
    expect(sameSitters(one, sittersByChair('c1', '#0f0', []))).toBe(false);
    expect(sameSitters(one, sittersByChair('c2', '#f00', []))).toBe(false);
  });
});
