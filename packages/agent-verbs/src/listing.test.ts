import { describe, expect, it } from 'vitest';
import { columns, day, LIST_MAX_LIMIT, minute, moreLine } from './listing';

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

  it('offer a --limit that shows the rest only while the flag would take it', () => {
    expect(moreLine(20, 5, LIST_MAX_LIMIT, 'narrow with a query')).toBe(
      '… 5 more; --limit 25, or narrow with a query',
    );
    expect(moreLine(20, 300, LIST_MAX_LIMIT, 'narrow with a query')).toBe(
      `… 300 more; narrow with a query (--limit goes up to ${LIST_MAX_LIMIT})`,
    );
  });
});
