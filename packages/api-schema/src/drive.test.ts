import { describe, expect, it } from 'vitest';
import {
  DRIVE_FILE_EXTENSION,
  driveRootName,
  driveFileName,
  isDriveFileId,
  isDriveLeaseHolder,
  isLiveplannerId,
  stripDriveName,
} from './drive';

describe('driveFileName', () => {
  it('appends the .liveplanner extension', () => {
    expect(driveFileName('Roadmap')).toBe(`Roadmap${DRIVE_FILE_EXTENSION}`);
  });
});

describe('stripDriveName', () => {
  it('drops the .liveplanner extension', () => {
    expect(stripDriveName('Roadmap.liveplanner')).toBe('Roadmap');
  });

  it('drops the extension case-insensitively and trims', () => {
    expect(stripDriveName('  Plan.LIVEPLANNER ')).toBe('Plan');
  });

  it('keeps a name without the extension', () => {
    expect(stripDriveName('Plan v2')).toBe('Plan v2');
  });

  it('answers null for a name that is empty once stripped', () => {
    expect(stripDriveName('.liveplanner')).toBeNull();
    expect(stripDriveName('   ')).toBeNull();
  });

  it('truncates to the given maximum', () => {
    expect(stripDriveName('abcdef.liveplanner', 3)).toBe('abc');
  });
});

describe('id validators', () => {
  it('accepts Drive-shaped file ids and refuses the rest', () => {
    expect(isDriveFileId('1AbC_d-9')).toBe(true);
    expect(isDriveFileId('')).toBe(false);
    expect(isDriveFileId('a/b')).toBe(false);
    expect(isDriveFileId('x'.repeat(201))).toBe(false);
  });

  it('accepts liveplanner ids (uuid and short ids)', () => {
    expect(isLiveplannerId('0f5ca4af-9a8a-4a60-be5e-1179e5555880')).toBe(true);
    expect(isLiveplannerId('abc_123')).toBe(true);
    expect(isLiveplannerId('../etc')).toBe(false);
  });

  it('accepts a lease holder of 1..64 url-safe characters', () => {
    expect(isDriveLeaseHolder('device-1')).toBe(true);
    expect(isDriveLeaseHolder('')).toBe(false);
    expect(isDriveLeaseHolder('a'.repeat(65))).toBe(false);
    expect(isDriveLeaseHolder('bad holder')).toBe(false);
  });
});

describe('driveRootName (docs/specs/022-drive-mirror/drive-mirror.md, "The root folder\'s name")', () => {
  it.each([
    ['liveplanner.app', 'liveplanner'],
    ['www.liveplanner.app', 'liveplanner'],
    ['WWW.LivePlanner.App', 'liveplanner'],
    ['staging.liveplanner.app', 'liveplanner (staging)'],
    ['Staging.LIVEPLANNER.app', 'liveplanner (staging)'],
    ['localhost', 'liveplanner (staging)'],
    ['localhost:3100', 'liveplanner (staging)'],
    ['LOCALHOST:3002', 'liveplanner (staging)'],
    ['127.0.0.1', 'liveplanner (staging)'],
    ['127.0.0.1:3771', 'liveplanner (staging)'],
    ['[::1]', 'liveplanner (staging)'],
    ['[::1]:3100', 'liveplanner (staging)'],
    ['::1', 'liveplanner (staging)'],
    ['documents.example.org', 'liveplanner (self-hosted)'],
    ['documents.example.org:8443', 'liveplanner (self-hosted)'],
    ['192.168.1.20:3000', 'liveplanner (self-hosted)'],
    ['[2001:db8::1]:3000', 'liveplanner (self-hosted)'],
    ['liveplanner.app.evil.example', 'liveplanner (self-hosted)'],
    ['staging.liveplanner.app.example', 'liveplanner (self-hosted)'],
  ])('%s → %s', (host, name) => {
    expect(driveRootName(host)).toBe(name);
  });
});
