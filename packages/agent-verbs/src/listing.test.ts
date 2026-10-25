import { describe, expect, it } from 'vitest';
import { columns, day, minute } from './listing';

describe('the list helpers', () => {
  it('print dates in UTC, whatever the machine', () => {
    const at = Date.UTC(2026, 9, 5, 8, 7, 30);
    expect(day(at)).toBe('2026-10-05');
    expect(minute(at)).toBe('2026-10-05 08:07');
  });

  it('align columns two spaces apart, leaving the last unpadded', () => {
    expect(
      columns([
        ['a', 'long name', 'x'],
        ['abc', 'b', 'yy'],
      ]),
    ).toEqual(['a    long name  x', 'abc  b          yy']);
    expect(columns([])).toEqual([]);
  });
});
