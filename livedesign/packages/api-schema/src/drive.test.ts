import { describe, expect, it } from 'vitest';
import {
  DRIVE_FILE_EXTENSION,
  driveRootName,
  driveFileName,
  isDriveFileId,
  isDriveLeaseHolder,
  isLivedesignId,
  stripDriveName,
} from './drive';

describe('driveFileName', () => {
  it('appends the .livedesign extension', () => {
    expect(driveFileName('Roadmap')).toBe(`Roadmap${DRIVE_FILE_EXTENSION}`);
  });
});

describe('stripDriveName', () => {
  it('drops the .livedesign extension', () => {
    expect(stripDriveName('Roadmap.livedesign')).toBe('Roadmap');
  });

  it('drops the extension case-insensitively and trims', () => {
    expect(stripDriveName('  Plan.LIVEDESIGN ')).toBe('Plan');
  });

  it('keeps a name without the extension', () => {
    expect(stripDriveName('Plan v2')).toBe('Plan v2');
  });

  it('answers null for a name that is empty once stripped', () => {
    expect(stripDriveName('.livedesign')).toBeNull();
    expect(stripDriveName('   ')).toBeNull();
  });

  it('truncates to the given maximum', () => {
    expect(stripDriveName('abcdef.livedesign', 3)).toBe('abc');
  });
});

describe('id validators', () => {
  it('accepts Drive-shaped file ids and refuses the rest', () => {
    expect(isDriveFileId('1AbC_d-9')).toBe(true);
    expect(isDriveFileId('')).toBe(false);
    expect(isDriveFileId('a/b')).toBe(false);
    expect(isDriveFileId('x'.repeat(201))).toBe(false);
  });

  it('accepts livedesign ids (uuid and short ids)', () => {
    expect(isLivedesignId('0f5ca4af-9a8a-4a60-be5e-1179e5555880')).toBe(true);
    expect(isLivedesignId('abc_123')).toBe(true);
    expect(isLivedesignId('../etc')).toBe(false);
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
    ['livedesign.app', 'livedesign'],
    ['www.livedesign.app', 'livedesign'],
    ['WWW.LiveDesign.App', 'livedesign'],
    ['staging.livedesign.app', 'livedesign (staging)'],
    ['Staging.LIVEDESIGN.app', 'livedesign (staging)'],
    ['localhost', 'livedesign (staging)'],
    ['localhost:3300', 'livedesign (staging)'],
    ['LOCALHOST:3002', 'livedesign (staging)'],
    ['127.0.0.1', 'livedesign (staging)'],
    ['127.0.0.1:3771', 'livedesign (staging)'],
    ['[::1]', 'livedesign (staging)'],
    ['[::1]:3300', 'livedesign (staging)'],
    ['::1', 'livedesign (staging)'],
    ['documents.example.org', 'livedesign (self-hosted)'],
    ['documents.example.org:8443', 'livedesign (self-hosted)'],
    ['192.168.1.20:3000', 'livedesign (self-hosted)'],
    ['[2001:db8::1]:3300', 'livedesign (self-hosted)'],
    ['livedesign.app.evil.example', 'livedesign (self-hosted)'],
    ['staging.livedesign.app.example', 'livedesign (self-hosted)'],
  ])('%s → %s', (host, name) => {
    expect(driveRootName(host)).toBe(name);
  });
});
