import { describe, expect, it } from 'vitest';
import { carriedHref, lensHref, lensViewOf, SEARCH_RESULTS_PATH } from './lens-views';

describe('lensViewOf', () => {
  it('reads My documents, its folders, a team and This browser as scoped', () => {
    for (const kind of ['all', 'folder', 'team', 'offline'] as const) {
      expect(lensViewOf(kind)).toBe('scoped');
    }
  });

  it('reads Recent, Favourites, Search results and Shared with me as aggregate', () => {
    for (const kind of ['recent', 'favourites', 'search', 'shared'] as const) {
      expect(lensViewOf(kind)).toBe('aggregate');
    }
  });

  it('gives the views that list no documents no lens', () => {
    for (const kind of [
      'timeline',
      'activity',
      'gallery',
      'themes',
      'shape-libraries',
      'trash',
      'invites',
    ] as const) {
      expect(lensViewOf(kind)).toBeNull();
    }
  });
});

describe('lensHref', () => {
  it('adds the normalised lens as q', () => {
    expect(lensHref(SEARCH_RESULTS_PATH, '  made-by:ai   plan ')).toBe(
      '/explorer/search?q=made-by%3Aai+plan',
    );
  });

  it('keeps the query a path already has', () => {
    expect(lensHref('/explorer/folder?id=f1', 'plan')).toBe('/explorer/folder?id=f1&q=plan');
  });

  it('writes no q for an empty lens', () => {
    expect(lensHref('/explorer/recent', '   ')).toBe('/explorer/recent');
  });
});

describe('carriedHref', () => {
  it('carries the lens from one aggregate view to another', () => {
    expect(carriedHref('/explorer/shared', 'plan', 'aggregate', 'aggregate')).toBe(
      '/explorer/shared?q=plan',
    );
  });

  it('starts a scoped view, or one with no lens, unfiltered', () => {
    expect(carriedHref('/explorer/all', 'plan', 'aggregate', 'scoped')).toBe('/explorer/all');
    expect(carriedHref('/explorer/timeline', 'plan', 'aggregate', null)).toBe('/explorer/timeline');
  });

  it('carries nothing out of a scoped view', () => {
    expect(carriedHref('/explorer/recent', 'plan', 'scoped', 'aggregate')).toBe('/explorer/recent');
  });
});
