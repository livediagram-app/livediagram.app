import { NAME_MAX_LENGTH } from '@livediagram/document';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capStoredName } from './names';

const long = 'Quarterly platform migration plan for the payments team and friends';

describe('capStoredName', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shortens a new name past the cap at a word boundary', () => {
    const stored = capStoredName(long, null, 'document');
    expect([...stored].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
    expect(stored.endsWith('…')).toBe(true);
    expect(long.startsWith(stored.slice(0, -1))).toBe(true);
  });

  it('shortens a changed name even when an over-long one is stored', () => {
    const stored = capStoredName(`${long} v2`, long, 'tab');
    expect([...stored].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
  });

  it('leaves a name sent back unchanged alone, however long', () => {
    expect(capStoredName(long, long, 'tab')).toBe(long);
  });

  it('collapses whitespace in a name within the cap', () => {
    expect(capStoredName('  Q3\n  plan  ', null, 'document')).toBe('Q3 plan');
  });

  it('returns a fitting name as-is and logs nothing', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(capStoredName('Checkout flow', null, 'document')).toBe('Checkout flow');
    expect(info).not.toHaveBeenCalled();
  });

  it('logs the original and stored lengths when it shortens', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const stored = capStoredName(long, null, 'tab');
    expect(info).toHaveBeenCalledWith('[names] capped tab name', long.length, [...stored].length);
  });
});
