import { describe, expect, it } from 'vitest';
import {
  DRIVE_FILE_EXTENSION,
  driveRootName,
  driveFileName,
  isDriveFileId,
  isDriveLeaseHolder,
  isLivediagramId,
  stripDriveName,
} from './drive';

describe('driveFileName', () => {
  it('appends the .livediagram extension', () => {
    expect(driveFileName('Roadmap')).toBe(`Roadmap${DRIVE_FILE_EXTENSION}`);
  });
});

describe('stripDriveName', () => {
  it('drops the .livediagram extension', () => {
    expect(stripDriveName('Roadmap.livediagram')).toBe('Roadmap');
  });

  it('drops the extension case-insensitively and trims', () => {
    expect(stripDriveName('  Plan.LIVEDIAGRAM ')).toBe('Plan');
  });

  it('keeps a name without the extension', () => {
    expect(stripDriveName('Plan v2')).toBe('Plan v2');
  });

  it('answers null for a name that is empty once stripped', () => {
    expect(stripDriveName('.livediagram')).toBeNull();
    expect(stripDriveName('   ')).toBeNull();
  });

  it('truncates to the given maximum', () => {
    expect(stripDriveName('abcdef.livediagram', 3)).toBe('abc');
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

describe('driveRootName (docs/specs/022-drive-mirror/drive-mirror.md, "The root folder\'s name")', () => {
  it.each([
    ['livediagram.app', 'livediagram'],
    ['www.livediagram.app', 'livediagram'],
    ['WWW.LiveDiagram.App', 'livediagram'],
    ['staging.livediagram.app', 'livediagram (staging)'],
    ['Staging.LIVEDIAGRAM.app', 'livediagram (staging)'],
    ['localhost', 'livediagram (staging)'],
    ['localhost:3000', 'livediagram (staging)'],
    ['LOCALHOST:3002', 'livediagram (staging)'],
    ['127.0.0.1', 'livediagram (staging)'],
    ['127.0.0.1:3771', 'livediagram (staging)'],
    ['[::1]', 'livediagram (staging)'],
    ['[::1]:3000', 'livediagram (staging)'],
    ['::1', 'livediagram (staging)'],
    ['diagrams.example.org', 'livediagram (self-hosted)'],
    ['diagrams.example.org:8443', 'livediagram (self-hosted)'],
    ['192.168.1.20:3000', 'livediagram (self-hosted)'],
    ['[2001:db8::1]:3000', 'livediagram (self-hosted)'],
    ['livediagram.app.evil.example', 'livediagram (self-hosted)'],
    ['staging.livediagram.app.example', 'livediagram (self-hosted)'],
  ])('%s → %s', (host, name) => {
    expect(driveRootName(host)).toBe(name);
  });
});
