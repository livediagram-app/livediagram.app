import { describe, expect, it } from 'vitest';
import {
  D1_MAX_ROW_BYTES,
  D1_ROW_HEADROOM_BYTES,
  MAX_TAB_BYTES,
  tabDataBytes,
  tabTooLarge,
} from './tab-size';

// docs/specs/015-api/api.md "Tab size": a tab's data fits one D1 row.
describe('the tab size cap', () => {
  it('is D1’s row cap less the headroom for the row’s other columns', () => {
    expect(D1_MAX_ROW_BYTES).toBe(2_000_000);
    expect(MAX_TAB_BYTES).toBe(D1_MAX_ROW_BYTES - D1_ROW_HEADROOM_BYTES);
    expect(MAX_TAB_BYTES).toBe(1_991_808);
    // The other columns at their largest: a UUID id, a 60-character name of 4-byte characters,
    // an integer timestamp, a record header of a few bytes a column.
    expect(36 + 60 * 4 + 8 + 64).toBeLessThan(D1_ROW_HEADROOM_BYTES);
  });

  it('measures the stored data: UTF-8 JSON without the id and name', () => {
    const tab = { id: 'abc', name: 'Board', elements: [], note: 'é' };
    expect(tabDataBytes(tab)).toBe(new TextEncoder().encode('{"elements":[],"note":"é"}').length);
  });

  it('refuses one byte over the cap and keeps one at it', () => {
    const at = (bytes: number) => {
      const fill = 'x'.repeat(bytes - tabDataBytes({ id: 'i', name: 'n', pad: '' }));
      return { id: 'i', name: 'n', pad: fill };
    };
    expect(tabDataBytes(at(MAX_TAB_BYTES))).toBe(MAX_TAB_BYTES);
    expect(tabTooLarge(at(MAX_TAB_BYTES))).toBe(false);
    expect(tabTooLarge(at(MAX_TAB_BYTES + 1))).toBe(true);
  });

  it('counts multi-byte characters as their bytes', () => {
    const fill = 'é'.repeat(MAX_TAB_BYTES / 2);
    expect(tabTooLarge({ id: 'i', name: 'n', pad: fill })).toBe(true);
  });
});
