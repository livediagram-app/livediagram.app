import { describe, expect, it } from 'vitest';
import { compileQuery, type QueryFile } from './query';

const file = (over: Partial<QueryFile> = {}): QueryFile => ({
  parents: ['root'],
  trashed: false,
  mimeType: 'application/vnd.livediagram+json',
  appProperties: { ldOrigin: 'livediagram.app' },
  ...over,
});

describe('compileQuery', () => {
  it('matches every supported clause, joined by and', () => {
    const q = compileQuery(
      "appProperties has { key='ldOrigin' and value='livediagram.app' } and trashed = false and 'root' in parents",
    );
    expect(q(file())).toBe(true);
    expect(q(file({ trashed: true }))).toBe(false);
    expect(q(file({ parents: ['x'] }))).toBe(false);
    expect(q(file({ appProperties: { ldOrigin: 'other' } }))).toBe(false);
  });

  it('filters by mime type', () => {
    expect(compileQuery("mimeType = 'application/vnd.google-apps.folder'")(file())).toBe(false);
    expect(compileQuery("mimeType != 'application/vnd.google-apps.folder'")(file())).toBe(true);
  });

  it('matches everything for an empty query and throws on anything unknown', () => {
    expect(compileQuery(null)(file())).toBe(true);
    expect(() => compileQuery("name contains 'x'")).toThrow(/unsupported/);
  });
});
