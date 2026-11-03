import { describe, expect, it } from 'vitest';
import {
  EXPORT_MAX_BYTES,
  EXPORT_PART_BYTES,
  exportFileName,
  exportKeyOf,
  exportLinkMessage,
  exportProgress,
  exportRetryDelay,
  isExportLinkRefusal,
  parseExportKey,
} from './index';

describe('export keys', () => {
  it('names a person and a team, and reads them back', () => {
    expect(exportKeyOf({ kind: 'personal', personId: 'user_ada' })).toBe('personal:user_ada');
    expect(exportKeyOf({ kind: 'team', teamId: 't1' })).toBe('team:t1');
    expect(parseExportKey('personal:user_ada')).toEqual({ kind: 'personal', personId: 'user_ada' });
    expect(parseExportKey('team:t1')).toEqual({ kind: 'team', teamId: 't1' });
  });

  it('refuses anything else', () => {
    for (const bad of [null, 3, '', 'personal', 'personal:', 'folder:x', 'team:a/b', 'team:a:b']) {
      expect(parseExportKey(bad)).toBeNull();
    }
  });
});

describe('limits', () => {
  it('keep a zip in the plain format and parts R2 takes', () => {
    expect(EXPORT_MAX_BYTES).toBeLessThan(2 ** 32);
    expect(EXPORT_PART_BYTES).toBeGreaterThanOrEqual(5 * 1024 * 1024);
  });

  it('back off from 5 seconds, doubling, to at most 5 minutes', () => {
    expect(exportRetryDelay(0)).toBe(5000);
    expect(exportRetryDelay(1)).toBe(5000);
    expect(exportRetryDelay(2)).toBe(10_000);
    expect(exportRetryDelay(20)).toBe(300_000);
  });
});

describe('exportProgress', () => {
  const base = { itemsTotal: 0, itemsDone: 0, imagesTotal: 0, imagesDone: 0 };
  it('is whole when ready and nothing when stopped', () => {
    expect(exportProgress({ ...base, status: 'ready', phase: null })).toBe(1);
    expect(exportProgress({ ...base, status: 'failed', phase: 'items' })).toBe(0);
  });

  it('follows the phases and the work done', () => {
    expect(exportProgress({ ...base, status: 'running', phase: 'listing' })).toBe(0.02);
    expect(exportProgress({ ...base, status: 'running', phase: null })).toBe(0.02);
    expect(exportProgress({ ...base, status: 'running', phase: 'finishing' })).toBe(0.97);
    expect(exportProgress({ ...base, status: 'running', phase: 'items' })).toBe(0.95);
    expect(
      exportProgress({
        status: 'running',
        phase: 'items',
        itemsTotal: 8,
        itemsDone: 4,
        imagesTotal: 2,
        imagesDone: 0,
      }),
    ).toBeCloseTo(0.05 + 0.9 * 0.4);
  });
});

describe('the link', () => {
  it('signs who, which export, which run and when', () => {
    expect(exportLinkMessage('user_ada', 'personal:user_ada', 'ex_1', 99)).toBe(
      'user_ada\npersonal:user_ada\nex_1\n99',
    );
  });

  it('names its refusals', () => {
    expect(isExportLinkRefusal('expired')).toBe(true);
    expect(isExportLinkRefusal('other-account')).toBe(true);
    expect(isExportLinkRefusal('nope')).toBe(false);
  });
});

it('names the file by the day', () => {
  expect(exportFileName(Date.UTC(2026, 10, 1, 18))).toBe('liveworkspace-data-2026-11-01.zip');
});
