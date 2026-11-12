import { describe, expect, it } from 'vitest';
import {
  TAB_SAVE_CHANGES_MAX_CHARS,
  decodeTabSaveChanges,
  encodeTabSaveChanges,
} from './tab-save-changes';

describe('the X-Save-Changes envelope', () => {
  it('round-trips any text as a Latin-1 header value', () => {
    const changes = { pages: [{ kind: 'put', id: 'página ✓', after: null }] };
    const value = encodeTabSaveChanges(changes)!;
    expect(/^[\x20-\x7e]*$/.test(value)).toBe(true);
    expect(decodeTabSaveChanges(value)).toEqual(changes);
  });

  it('is null past the cap, either way', () => {
    const big = { pages: 'x'.repeat(TAB_SAVE_CHANGES_MAX_CHARS) };
    expect(encodeTabSaveChanges(big)).toBeNull();
    expect(decodeTabSaveChanges('%7B'.repeat(TAB_SAVE_CHANGES_MAX_CHARS))).toBeNull();
  });

  it('reads back only a JSON object', () => {
    expect(decodeTabSaveChanges(null)).toBeNull();
    expect(decodeTabSaveChanges('%E0%A4%A')).toBeNull();
    expect(decodeTabSaveChanges(encodeURIComponent('[1]'))).toBeNull();
    expect(decodeTabSaveChanges(encodeURIComponent('null'))).toBeNull();
  });
});
