import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatDateTime,
  formatItems,
  formatObjects,
  formatSize,
} from './details-format';

// docs/specs/013-workspace/explorer-details-view.md "Columns".

describe('formatObjects / formatItems', () => {
  it('names one and many', () => {
    expect(formatObjects(1)).toBe('1 object');
    expect(formatObjects(0)).toBe('0 objects');
    expect(formatObjects(1200, 'en-GB')).toBe('1,200 objects');
    expect(formatItems(1)).toBe('1 item');
    expect(formatItems(3)).toBe('3 items');
  });
});

describe('formatBytes', () => {
  it('shows kilobytes, one decimal below 10, whole numbers above', () => {
    expect(formatBytes(410, 'en-GB')).toBe('0.4 KB');
    expect(formatBytes(0, 'en-GB')).toBe('0 KB');
    expect(formatBytes(5 * 1024 + 300, 'en-GB')).toBe('5.3 KB');
    expect(formatBytes(12 * 1024 + 300, 'en-GB')).toBe('12 KB');
  });

  it('switches to megabytes from 1 MB', () => {
    expect(formatBytes(1024 * 1024 - 1, 'en-GB')).toBe('1,024 KB');
    expect(formatBytes(1.24 * 1024 * 1024, 'en-GB')).toBe('1.2 MB');
    expect(formatBytes(15.6 * 1024 * 1024, 'en-GB')).toBe('16 MB');
  });
});

describe('formatSize', () => {
  it('reads "N objects (S)"', () => {
    expect(formatSize({ elements: 12, bytes: 12 * 1024 }, 'en-GB')).toBe('12 objects (12 KB)');
  });
});

describe('formatDateTime', () => {
  it('shows a medium date and a short time in the locale', () => {
    const at = Date.UTC(2026, 9, 10, 16, 2);
    expect(formatDateTime(at, { locale: 'en-GB', timeZone: 'UTC' })).toBe('10 Oct 2026, 16:02');
  });
});
