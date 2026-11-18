// @vitest-environment jsdom

// Which folders start open on load (docs/specs/006-document/tab-folders.md "A small bar starts with its folders open,
// on desktop"): every folder on a small desktop bar, none on a busy one or a phone.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { foldersOpenOnLoad } from './tab-folder-start';

const loose = () => ({ kind: 'loose' as const });
const folder = (name: string, size: number) => ({
  kind: 'folder' as const,
  name,
  tabs: Array.from({ length: size }, (_, i) => i),
});
const phone = (matches: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches })),
  );
const open = (runs: Parameters<typeof foldersOpenOnLoad>[0]) => [...foldersOpenOnLoad(runs)];

afterEach(() => vi.unstubAllGlobals());

describe('foldersOpenOnLoad', () => {
  it('opens every folder of a small desktop bar', () => {
    phone(false);
    expect(open([loose(), folder('A', 2), folder('B', 3), loose()])).toEqual(['A', 'B']);
  });

  it('opens up to 3 folders, and none at 4', () => {
    phone(false);
    expect(open([folder('A', 1), folder('B', 1), folder('C', 1)])).toEqual(['A', 'B', 'C']);
    expect(open([folder('A', 1), folder('B', 1), folder('C', 1), folder('D', 1)])).toEqual([]);
  });

  it('opens folders of up to 3 tabs, and none when one holds 4', () => {
    phone(false);
    expect(open([folder('A', 3), folder('B', 1)])).toEqual(['A', 'B']);
    expect(open([folder('A', 4), folder('B', 1)])).toEqual([]);
  });

  it('opens up to 9 tabs in all, loose tabs included, and none at 10', () => {
    phone(false);
    const nine = [folder('A', 3), folder('B', 3), folder('C', 2), loose()];
    expect(open(nine)).toEqual(['A', 'B', 'C']);
    expect(open([...nine, loose()])).toEqual([]);
  });

  it('opens nothing on a phone', () => {
    phone(true);
    expect(open([folder('A', 2), loose()])).toEqual([]);
  });

  it('has nothing to open on a bar without folders', () => {
    phone(false);
    expect(open([loose(), loose()])).toEqual([]);
  });
});
