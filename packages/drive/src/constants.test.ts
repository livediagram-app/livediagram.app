import { describe, expect, it } from 'vitest';
import {
  DRIVE_CHANNEL_RENEW_BEFORE_MS,
  DRIVE_CHANNEL_TTL_MS,
  DRIVE_FALLBACK_CHECK_MS,
  DRIVE_FALLBACK_CHECK_WATCHED_MS,
  DRIVE_ITEM_MIN_WRITE_INTERVAL_MAX_MS,
  DRIVE_ITEM_MIN_WRITE_INTERVAL_MS,
  DRIVE_PASS_DEBOUNCE_MS,
  DRIVE_PROP_APP,
  DRIVE_PROP_FOLDER_ID,
  DRIVE_PROP_ITEM_ID,
  DRIVE_PROP_ORIGIN,
  DRIVE_PROP_ROOT,
  DRIVE_STATE_TTL_MS,
  DRIVE_THUMBNAIL_PX,
  driveRootName,
  GOOGLE_CALL_TIMEOUT_MS,
  isDriveId,
} from './constants';

describe('isDriveId', () => {
  it('accepts Drive file ids and liveworkspace ids: url-safe characters', () => {
    expect(isDriveId('1AbC-dEf_9')).toBe(true);
    expect(isDriveId('file-1')).toBe(true);
    expect(isDriveId('x')).toBe(true);
    expect(isDriveId('a'.repeat(200))).toBe(true);
  });

  it('refuses empty, too long, other characters and non-strings', () => {
    expect(isDriveId('')).toBe(false);
    expect(isDriveId('a'.repeat(201))).toBe(false);
    for (const bad of ['a b', 'a/b', 'a.b', '../x', 'a?b=1', 'a%20', 'é', 'a\n']) {
      expect(isDriveId(bad)).toBe(false);
    }
    expect(isDriveId(undefined)).toBe(false);
    expect(isDriveId(null)).toBe(false);
    expect(isDriveId(42)).toBe(false);
    expect(isDriveId(['a'])).toBe(false);
  });
});

describe('driveRootName', () => {
  it('names one root per environment, so staging never writes into production’s', () => {
    expect(driveRootName('production')).toBe('liveworkspace');
    expect(driveRootName('staging')).toBe('liveworkspace (staging)');
    expect(driveRootName('development')).toBe('liveworkspace (development)');
  });
});

describe('the cadence (liveworkspace/docs/specs/005-drive/drive.md "Cadence")', () => {
  it('holds the spec’s values', () => {
    expect(DRIVE_PASS_DEBOUNCE_MS).toBe(30_000);
    expect(DRIVE_ITEM_MIN_WRITE_INTERVAL_MS).toBe(5 * 60_000);
    expect(DRIVE_FALLBACK_CHECK_MS).toBe(30 * 60_000);
    expect(DRIVE_FALLBACK_CHECK_WATCHED_MS).toBe(6 * 3_600_000);
    expect(DRIVE_STATE_TTL_MS).toBe(10 * 60_000);
    expect(DRIVE_CHANNEL_TTL_MS).toBe(7 * 24 * 3_600_000);
    expect(DRIVE_THUMBNAIL_PX).toBeGreaterThanOrEqual(220);
  });

  it('keeps each ceiling above its base, and the renewal inside the channel’s life', () => {
    expect(DRIVE_ITEM_MIN_WRITE_INTERVAL_MAX_MS).toBeGreaterThan(DRIVE_ITEM_MIN_WRITE_INTERVAL_MS);
    expect(DRIVE_CHANNEL_RENEW_BEFORE_MS).toBeLessThan(DRIVE_CHANNEL_TTL_MS);
    expect(GOOGLE_CALL_TIMEOUT_MS).toBeGreaterThanOrEqual(3_000);
    expect(GOOGLE_CALL_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('keeps each appProperties key short enough to leave room for its value (124 bytes in all)', () => {
    const keys = [
      DRIVE_PROP_ITEM_ID,
      DRIVE_PROP_APP,
      DRIVE_PROP_FOLDER_ID,
      DRIVE_PROP_ORIGIN,
      DRIVE_PROP_ROOT,
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key.startsWith('lw')).toBe(true);
      expect(key.length).toBeLessThan(16);
    }
  });
});
