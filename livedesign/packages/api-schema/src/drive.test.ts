import { describe, expect, it } from 'vitest';
import {
  DRIVE_FILE_EXTENSION,
  driveRootName,
  driveFileName,
  isDriveFileId,
  isDriveLeaseHolder,
  isLivepagesId,
  stripDriveName,
} from './drive';

describe('driveFileName', () => {
  it('appends the .livepages extension', () => {
    expect(driveFileName('Roadmap')).toBe(`Roadmap${DRIVE_FILE_EXTENSION}`);
  });
});

describe('stripDriveName', () => {
  it('drops the .livepages extension', () => {
    expect(stripDriveName('Roadmap.livepages')).toBe('Roadmap');
  });

  it('drops the extension case-insensitively and trims', () => {
    expect(stripDriveName('  Plan.LIVEPAGES ')).toBe('Plan');
  });

  it('keeps a name without the extension', () => {
    expect(stripDriveName('Plan v2')).toBe('Plan v2');
  });

  it('answers null for a name that is empty once stripped', () => {
    expect(stripDriveName('.livepages')).toBeNull();
    expect(stripDriveName('   ')).toBeNull();
  });

  it('truncates to the given maximum', () => {
    expect(stripDriveName('abcdef.livepages', 3)).toBe('abc');
  });
});

describe('id validators', () => {
  it('accepts Drive-shaped file ids and refuses the rest', () => {
    expect(isDriveFileId('1AbC_d-9')).toBe(true);
    expect(isDriveFileId('')).toBe(false);
    expect(isDriveFileId('a/b')).toBe(false);
    expect(isDriveFileId('x'.repeat(201))).toBe(false);
  });

  it('accepts livepages ids (uuid and short ids)', () => {
    expect(isLivepagesId('0f5ca4af-9a8a-4a60-be5e-1179e5555880')).toBe(true);
    expect(isLivepagesId('abc_123')).toBe(true);
    expect(isLivepagesId('../etc')).toBe(false);
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
    ['livepages.app', 'livepages'],
    ['www.livepages.app', 'livepages'],
    ['WWW.LivePages.App', 'livepages'],
    ['staging.livepages.app', 'livepages (staging)'],
    ['Staging.LIVEPAGES.app', 'livepages (staging)'],
    ['localhost', 'livepages (staging)'],
    ['localhost:3200', 'livepages (staging)'],
    ['LOCALHOST:3002', 'livepages (staging)'],
    ['127.0.0.1', 'livepages (staging)'],
    ['127.0.0.1:3771', 'livepages (staging)'],
    ['[::1]', 'livepages (staging)'],
    ['[::1]:3200', 'livepages (staging)'],
    ['::1', 'livepages (staging)'],
    ['documents.example.org', 'livepages (self-hosted)'],
    ['documents.example.org:8443', 'livepages (self-hosted)'],
    ['192.168.1.20:3000', 'livepages (self-hosted)'],
    ['[2001:db8::1]:3200', 'livepages (self-hosted)'],
    ['livepages.app.evil.example', 'livepages (self-hosted)'],
    ['staging.livepages.app.example', 'livepages (self-hosted)'],
  ])('%s → %s', (host, name) => {
    expect(driveRootName(host)).toBe(name);
  });
});
