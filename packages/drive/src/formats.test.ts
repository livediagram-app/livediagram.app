import { describe, expect, it } from 'vitest';
import {
  APP_FILE_FORMATS,
  APP_NAMES,
  appNameOfSite,
  driveFileName,
  formatOfKind,
  formatOfMime,
  isAppName,
  stripDriveName,
} from './formats';

// The file each app's item becomes in Drive (liveworkspace/docs/drive.md "The file").

describe('APP_FILE_FORMATS', () => {
  it('names the four apps with the spec table’s kind, MIME type and extension', () => {
    expect(APP_NAMES.toSorted()).toEqual([
      'livedesign',
      'livediagram',
      'livedocuments',
      'liveplanner',
    ]);
    expect(APP_FILE_FORMATS).toEqual({
      livediagram: {
        app: 'livediagram',
        kind: 'livediagram.document',
        mimeType: 'application/vnd.livediagram+json',
        extension: '.livediagram',
      },
      liveplanner: {
        app: 'liveplanner',
        kind: 'liveplanner.project',
        mimeType: 'application/vnd.liveplanner+json',
        extension: '.liveplanner',
      },
      livedocuments: {
        app: 'livedocuments',
        kind: 'livedocuments.document',
        mimeType: 'application/vnd.livedocuments+json',
        extension: '.livedocuments',
      },
      livedesign: {
        app: 'livedesign',
        kind: 'livedesign.design',
        mimeType: 'application/vnd.livedesign+json',
        extension: '.livedesign',
      },
    });
  });

  it('keys each format by its own app', () => {
    for (const app of APP_NAMES) expect(APP_FILE_FORMATS[app].app).toBe(app);
  });

  it('gives every app a distinct kind, MIME type and extension', () => {
    const formats = Object.values(APP_FILE_FORMATS);
    for (const field of ['kind', 'mimeType', 'extension'] as const) {
      expect(new Set(formats.map((f) => f[field])).size).toBe(formats.length);
    }
  });
});

describe('isAppName', () => {
  it('accepts the four apps', () => {
    for (const app of APP_NAMES) expect(isAppName(app)).toBe(true);
  });

  it('refuses anything else, including inherited object keys', () => {
    for (const value of [
      'liveworkspace',
      'livediagram.app',
      'LiveDiagram',
      '',
      'toString',
      '__proto__',
      1,
      null,
    ]) {
      expect(isAppName(value)).toBe(false);
    }
    expect(isAppName(undefined)).toBe(false);
  });
});

describe('appNameOfSite', () => {
  it('drops the .app', () => {
    expect(appNameOfSite('livediagram.app')).toBe('livediagram');
    expect(appNameOfSite('liveplanner.app')).toBe('liveplanner');
  });
});

describe('formatOfMime / formatOfKind', () => {
  it('finds each app’s format by its MIME type and its envelope kind', () => {
    for (const f of Object.values(APP_FILE_FORMATS)) {
      expect(formatOfMime(f.mimeType)).toBe(f);
      expect(formatOfKind(f.kind)).toBe(f);
    }
  });

  it('answers null for anything else', () => {
    expect(formatOfMime('application/json')).toBeNull();
    expect(formatOfMime('application/vnd.google-apps.folder')).toBeNull();
    expect(formatOfMime('')).toBeNull();
    expect(formatOfKind('livediagram')).toBeNull();
    expect(formatOfKind(undefined)).toBeNull();
    expect(formatOfKind(42)).toBeNull();
  });
});

describe('driveFileName', () => {
  it('appends the app’s extension', () => {
    expect(driveFileName('livediagram', 'Plan')).toBe('Plan.livediagram');
    expect(driveFileName('liveplanner', 'Roadmap')).toBe('Roadmap.liveplanner');
    expect(driveFileName('livedocuments', 'Notes')).toBe('Notes.livedocuments');
    expect(driveFileName('livedesign', 'Logo')).toBe('Logo.livedesign');
  });
});

describe('stripDriveName', () => {
  it('drops any app’s extension, whichever app the item is', () => {
    for (const app of APP_NAMES) expect(stripDriveName(driveFileName(app, 'Plan'))).toBe('Plan');
  });

  it('drops the extension whatever its case', () => {
    expect(stripDriveName('Plan.LiveDiagram')).toBe('Plan');
    expect(stripDriveName('Plan.LIVEPLANNER')).toBe('Plan');
  });

  it('drops one extension only', () => {
    expect(stripDriveName('Plan.livediagram.livediagram')).toBe('Plan.livediagram');
    expect(stripDriveName('Plan.liveplanner.livediagram')).toBe('Plan.liveplanner');
  });

  it('keeps a name with no app extension as it is, and other dots', () => {
    expect(stripDriveName('Plan')).toBe('Plan');
    expect(stripDriveName('Plan v1.2')).toBe('Plan v1.2');
    expect(stripDriveName('Plan.json')).toBe('Plan.json');
    expect(stripDriveName('Plan livediagram')).toBe('Plan livediagram');
  });

  it('trims around the name and before the extension', () => {
    expect(stripDriveName('  Plan  ')).toBe('Plan');
    expect(stripDriveName('  Plan .livediagram  ')).toBe('Plan');
  });

  it('cuts the name to the given length', () => {
    expect(stripDriveName('Roadmap.livediagram', 4)).toBe('Road');
    expect(stripDriveName(`${'x'.repeat(300)}.livedesign`, 200)).toBe('x'.repeat(200));
    expect(stripDriveName('Plan.livediagram', 200)).toBe('Plan');
  });

  it('answers null when nothing is left, so an empty rename keeps the old name', () => {
    expect(stripDriveName('')).toBeNull();
    expect(stripDriveName('   ')).toBeNull();
    for (const app of APP_NAMES) expect(stripDriveName(APP_FILE_FORMATS[app].extension)).toBeNull();
    expect(stripDriveName('  .livediagram ')).toBeNull();
  });
});
