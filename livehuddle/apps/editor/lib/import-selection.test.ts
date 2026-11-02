import { describe, expect, it } from 'vitest';
import { toggled, toggledAll } from './import-selection';

describe('toggled', () => {
  it('ticks an unticked key and unticks a ticked one, leaving the set it was given alone', () => {
    const start = new Set(['a']);
    expect([...toggled(start, 'b')]).toEqual(['a', 'b']);
    expect([...toggled(start, 'a')]).toEqual([]);
    expect([...start]).toEqual(['a']);
  });
});

describe('toggledAll', () => {
  it('ticks everything, or nothing when everything already is', () => {
    expect([...toggledAll(new Set(['a']), ['a', 'b'])]).toEqual(['a', 'b']);
    expect([...toggledAll(new Set(['a', 'b']), ['a', 'b'])]).toEqual([]);
    expect([...toggledAll(new Set(), [])]).toEqual([]);
  });
});
