// @vitest-environment jsdom

// The page each person was last on, per tab (docs/specs/007-editor/pages-mode.md "Back to
// the page you were on"): stored in this browser, capped, and found from where the view rests.

import { beforeEach, describe, expect, it } from 'vitest';
import type { LaidOutPage } from '@liveplanner/document';
import {
  LAST_PAGE_MAX,
  lastPageKey,
  pageNearestPoint,
  readLastPage,
  writeLastPage,
} from './last-page';

const STORAGE_KEY = 'liveplanner:v2:last-illustrate-page';
const page = (id: string, x: number): LaidOutPage =>
  ({ id, rect: { x, y: 0, width: 100, height: 140 } }) as unknown as LaidOutPage;
const row = [page('a', 0), page('b', 140), page('c', 280)];

beforeEach(() => localStorage.clear());

describe('the remembered page', () => {
  it('is kept per document and tab', () => {
    writeLastPage(lastPageKey('d1', 't1'), 'b');
    expect(readLastPage(lastPageKey('d1', 't1'))).toBe('b');
    expect(readLastPage(lastPageKey('d2', 't1'))).toBeUndefined();
  });

  it('reads nothing from a broken or foreign value', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readLastPage('d:t')).toBeUndefined();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['d:t']));
    expect(readLastPage('d:t')).toBeUndefined();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'd:t': 3, 'd:u': 'p' }));
    expect(readLastPage('d:t')).toBeUndefined();
    expect(readLastPage('d:u')).toBe('p');
  });

  it('keeps the most recent tabs, dropping the oldest past the cap', () => {
    for (let i = 0; i <= LAST_PAGE_MAX; i++) writeLastPage(`d:${i}`, 'p');
    expect(readLastPage('d:0')).toBeUndefined();
    expect(readLastPage(`d:${LAST_PAGE_MAX}`)).toBe('p');
    // A tab recorded again moves to the most recent, so it outlives the next drop.
    writeLastPage('d:1', 'q');
    writeLastPage('d:new', 'p');
    expect(readLastPage('d:1')).toBe('q');
    expect(readLastPage('d:2')).toBeUndefined();
  });
});

describe('the page the view is on', () => {
  it('is the page under the centre', () => {
    expect(pageNearestPoint(row, { x: 190, y: 70 })?.id).toBe('b');
  });

  it('is the nearest page from a gap or past the row', () => {
    expect(pageNearestPoint(row, { x: 118, y: 70 })?.id).toBe('a');
    expect(pageNearestPoint(row, { x: 125, y: 70 })?.id).toBe('b');
    expect(pageNearestPoint(row, { x: 5000, y: -400 })?.id).toBe('c');
  });

  it('is none without pages', () => {
    expect(pageNearestPoint([], { x: 0, y: 0 })).toBeUndefined();
  });
});
