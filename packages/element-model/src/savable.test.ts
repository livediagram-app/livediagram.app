import { describe, expect, it } from 'vitest';
import { savableElementsOf } from './savable';

// An import lands only what the api saves.
describe('savableElementsOf', () => {
  type El = { id: string; ok: boolean };
  const isValid = (el: unknown): el is El => (el as El).ok;
  const savableElements = (elements: readonly unknown[]) => savableElementsOf(elements, isValid, 3);
  const el = (id: string, ok = true): El => ({ id, ok });

  it('keeps valid elements once per id and counts the rest', () => {
    const { elements, dropped } = savableElements([el('a'), el('bad', false), el('a'), el('b')]);
    expect(elements.map((e) => e.id)).toEqual(['a', 'b']);
    expect(dropped).toBe(2);
  });

  it('stops at the tab cap', () => {
    const { elements, dropped } = savableElements(['a', 'b', 'c', 'd', 'e'].map((id) => el(id)));
    expect(elements).toHaveLength(3);
    expect(dropped).toBe(2);
  });
});
