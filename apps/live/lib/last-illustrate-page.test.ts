// @vitest-environment jsdom

// The page each person was last on, per tab (docs/specs/007-editor/illustrate-pages.md "Back to
// the page you were on"): stored in this browser, capped, and found from where the view rests.

import { beforeEach, describe, expect, it } from 'vitest';
import type { LaidOutPage } from '@livediagram/document';
import {
  LAST_ILLUSTRATE_PAGE_MAX,
  lastIllustratePageKey,
  pageNearestPoint,
  readLastIllustratePage,
  writeLastIllustratePage,
} from './last-illustrate-page';

const STORAGE_KEY = 'livediagram:v2:last-illustrate-page';
const page = (id: string, x: number): LaidOutPage =>
  ({ id, rect: { x, y: 0, width: 100, height: 140 } }) as unknown as LaidOutPage;
const row = [page('a', 0), page('b', 140), page('c', 280)];

beforeEach(() => localStorage.clear());

describe('the remembered page', () => {
  it('is kept per document and tab', () => {
    writeLastIllustratePage(lastIllustratePageKey('d1', 't1'), 'b');
    expect(readLastIllustratePage(lastIllustratePageKey('d1', 't1'))).toBe('b');
    expect(readLastIllustratePage(lastIllustratePageKey('d2', 't1'))).toBeUndefined();
  });

  it('reads nothing from a broken or foreign value', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readLastIllustratePage('d:t')).toBeUndefined();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['d:t']));
    expect(readLastIllustratePage('d:t')).toBeUndefined();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'd:t': 3, 'd:u': 'p' }));
    expect(readLastIllustratePage('d:t')).toBeUndefined();
    expect(readLastIllustratePage('d:u')).toBe('p');
  });

  it('keeps the most recent tabs, dropping the oldest past the cap', () => {
    for (let i = 0; i <= LAST_ILLUSTRATE_PAGE_MAX; i++) writeLastIllustratePage(`d:${i}`, 'p');
    expect(readLastIllustratePage('d:0')).toBeUndefined();
    expect(readLastIllustratePage(`d:${LAST_ILLUSTRATE_PAGE_MAX}`)).toBe('p');
    // A tab recorded again moves to the most recent, so it outlives the next drop.
    writeLastIllustratePage('d:1', 'q');
    writeLastIllustratePage('d:new', 'p');
    expect(readLastIllustratePage('d:1')).toBe('q');
    expect(readLastIllustratePage('d:2')).toBeUndefined();
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
