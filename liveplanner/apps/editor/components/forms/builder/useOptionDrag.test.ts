import { describe, expect, it } from 'vitest';
import { gapAt, movedOption } from './useOptionDrag';

// Dragging a choice's option (docs/specs/030-forms/forms.md "Question types", options).

const ROWS = [
  { top: 0, bottom: 36 },
  { top: 40, bottom: 76 },
  { top: 80, bottom: 116 },
];

describe('gapAt', () => {
  it('is the gap before a row until the pointer passes its middle', () => {
    expect(gapAt(ROWS, -20)).toBe(0);
    expect(gapAt(ROWS, 17)).toBe(0);
    expect(gapAt(ROWS, 19)).toBe(1);
    expect(gapAt(ROWS, 59)).toBe(2);
    expect(gapAt(ROWS, 500)).toBe(3);
  });
});

describe('movedOption', () => {
  const abc = ['A', 'B', 'C', 'D'];
  it('drops an option into a gap above or below where it was', () => {
    expect(movedOption(abc, 0, 4)).toEqual(['B', 'C', 'D', 'A']);
    expect(movedOption(abc, 3, 0)).toEqual(['D', 'A', 'B', 'C']);
    expect(movedOption(abc, 1, 3)).toEqual(['A', 'C', 'B', 'D']);
    expect(movedOption(abc, 2, 1)).toEqual(['A', 'C', 'B', 'D']);
  });
  it('leaves the list as it was on the gaps beside it, and for an option that is not there', () => {
    expect(movedOption(abc, 1, 1)).toEqual(abc);
    expect(movedOption(abc, 1, 2)).toEqual(abc);
    expect(movedOption(abc, 9, 0)).toEqual(abc);
    expect(movedOption(abc, -1, 0)).toEqual(abc);
  });
  it('keeps every option of a full list, quickly', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Option ${i + 1}`);
    const out = movedOption(many, 19, 0);
    expect(out).toHaveLength(20);
    expect(new Set(out).size).toBe(20);
    expect(out[0]).toBe('Option 20');
  });
});
