import { describe, expect, it } from 'vitest';
import {
  ACCESS_LEVELS,
  LEVEL_ORDER,
  LEVEL_TELEMETRY_TYPE,
  isAccessLevel,
  levelAtLeast,
  lowerLevel,
  parseStoredLevel,
} from './access-levels';

describe('access levels', () => {
  it('climbs view, participate, edit', () => {
    expect(levelAtLeast('edit', 'participate')).toBe(true);
    expect(levelAtLeast('participate', 'participate')).toBe(true);
    expect(levelAtLeast('participate', 'edit')).toBe(false);
    expect(levelAtLeast('view', 'participate')).toBe(false);
    expect(levelAtLeast('view', 'view')).toBe(true);
  });

  it('reads anything unknown as view, never higher', () => {
    expect(parseStoredLevel('participate')).toBe('participate');
    expect(parseStoredLevel('edit')).toBe('edit');
    for (const odd of ['admin', 'EDIT', '', null, undefined, 3, {}]) {
      expect(parseStoredLevel(odd)).toBe('view');
      expect(isAccessLevel(odd)).toBe(false);
    }
  });

  it('caps a level by a ceiling', () => {
    expect(lowerLevel('edit', 'participate')).toBe('participate');
    expect(lowerLevel('view', 'edit')).toBe('view');
    expect(lowerLevel('participate', null)).toBe('participate');
    expect(lowerLevel('participate')).toBe('participate');
  });

  it('orders the cards most capable first and names every level for telemetry', () => {
    expect([...LEVEL_ORDER].reverse()).toEqual([...ACCESS_LEVELS]);
    expect(Object.keys(LEVEL_TELEMETRY_TYPE).sort()).toEqual([...ACCESS_LEVELS].sort());
  });
});
