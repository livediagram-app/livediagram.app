import { describe, expect, it } from 'vitest';
import { createShape, MAX_ELEMENTS_PER_TAB, savableElements, type Element } from './index';

// docs/specs/020-import-export/board-import.md "What lands": an import lands only what the api saves.
describe('savableElements', () => {
  const square = (id: string) => ({ ...createShape('square', 0, 0), id }) as Element;

  it('keeps valid elements once per id and counts the rest', () => {
    const bad = { ...square('bad'), width: Number.NaN };
    const { elements, dropped } = savableElements([square('a'), bad, square('a'), square('b')]);
    expect(elements.map((e) => e.id)).toEqual(['a', 'b']);
    expect(dropped).toBe(2);
  });

  it('stops at the tab cap', () => {
    const many = Array.from({ length: MAX_ELEMENTS_PER_TAB + 3 }, (_, i) => square(`s${i}`));
    const { elements, dropped } = savableElements(many);
    expect(elements).toHaveLength(MAX_ELEMENTS_PER_TAB);
    expect(dropped).toBe(3);
  });
});
