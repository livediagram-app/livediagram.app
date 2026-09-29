import { describe, expect, it } from 'vitest';
import {
  DRIVE_FILE_EXTENSION,
  driveFileName,
  isDriveFileId,
  isDriveLeaseHolder,
  isLivediagramId,
  stripDriveName,
} from './drive';

describe('driveFileName', () => {
  it('appends the .livedoc extension', () => {
    expect(driveFileName('Roadmap')).toBe(`Roadmap${DRIVE_FILE_EXTENSION}`);
  });
});

describe('stripDriveName', () => {
  it('drops the .livedoc extension', () => {
    expect(stripDriveName('Roadmap.livedoc')).toBe('Roadmap');
  });

  it('drops the extension case-insensitively and trims', () => {
    expect(stripDriveName('  Plan.LIVEDOC ')).toBe('Plan');
  });

  it('keeps a name without the extension', () => {
    expect(stripDriveName('Plan v2')).toBe('Plan v2');
  });

  it('answers null for a name that is empty once stripped', () => {
    expect(stripDriveName('.livedoc')).toBeNull();
    expect(stripDriveName('   ')).toBeNull();
  });

  it('truncates to the given maximum', () => {
    expect(stripDriveName('abcdef.livedoc', 3)).toBe('abc');
  });
});

describe('id validators', () => {
  it('accepts Drive-shaped file ids and refuses the rest', () => {
    expect(isDriveFileId('1AbC_d-9')).toBe(true);
    expect(isDriveFileId('')).toBe(false);
    expect(isDriveFileId('a/b')).toBe(false);
    expect(isDriveFileId('x'.repeat(201))).toBe(false);
  });

  it('accepts livediagram ids (uuid and short ids)', () => {
    expect(isLivediagramId('0f5ca4af-9a8a-4a60-be5e-1179e5555880')).toBe(true);
    expect(isLivediagramId('abc_123')).toBe(true);
    expect(isLivediagramId('../etc')).toBe(false);
  });

  it('accepts a lease holder of 1..64 url-safe characters', () => {
    expect(isDriveLeaseHolder('device-1')).toBe(true);
    expect(isDriveLeaseHolder('')).toBe(false);
    expect(isDriveLeaseHolder('a'.repeat(65))).toBe(false);
    expect(isDriveLeaseHolder('bad holder')).toBe(false);
  });
});

describe('the Drive file extension (docs/specs/022-drive-mirror/drive-mirror.md, "The file")', () => {
  it('is .livedoc, while the MIME type keeps the product name', () => {
    expect(DRIVE_FILE_EXTENSION).toBe('.livedoc');
    expect(driveFileName('Plan')).toBe('Plan.livedoc');
  });

  it('never reads another extension: nothing shipped under one', () => {
    expect(stripDriveName('Plan.livediagram')).toBe('Plan.livediagram');
  });
});
