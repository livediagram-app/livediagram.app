// @vitest-environment jsdom
import { writeThisBrowser } from '@liveworkspace/explorer/this-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { archivedByIndex, archivedChangeFolderHref, archivedInThisBrowser } from './archived';

afterEach(() => window.localStorage.clear());

const item = (id: string, archivedAt: number | null) => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  lastOpenedAt: null,
  trashedAt: null,
  favourite: false,
  archivedAt,
});

describe('archived files in an editor', () => {
  it('sends Change Folder to the Explorer’s Archived, naming the file', () => {
    expect(archivedChangeFolderHref('a b')).toBe('/explorer/archived?move=a%20b');
    expect(archivedChangeFolderHref('d1', 'https://x.app')).toBe(
      'https://x.app/explorer/archived?move=d1',
    );
  });

  it('reads this browser’s mark, and nothing for an address with no file', () => {
    writeThisBrowser('livedesign', [item('kept', 5), item('live', null)]);
    expect(archivedInThisBrowser('livedesign', 'kept')).toBe(true);
    expect(archivedInThisBrowser('livedesign', 'live')).toBe(false);
    expect(archivedInThisBrowser('livediagram', 'kept')).toBe(false);
    expect(archivedInThisBrowser('livedesign', null)).toBe(false);
  });

  it('reads the index’s refusal, and only `archived`', () => {
    const refusal = (id: string) => (id === 'a' ? 'archived' : id === 'n' ? 'not_found' : null);
    expect(archivedByIndex('a', refusal)).toBe(true);
    expect(archivedByIndex('n', refusal)).toBe(false);
    expect(archivedByIndex('x', refusal)).toBe(false);
    expect(archivedByIndex(null, refusal)).toBe(false);
  });
});
