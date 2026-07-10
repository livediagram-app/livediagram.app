import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE_FAVOURITES, parseFavourites } from './palette-favourites';

const VALID = new Set([...DEFAULT_PALETTE_FAVOURITES, 'shapes:star', 'data:pie']);

describe('parseFavourites', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(parseFavourites(null, VALID)).toEqual([...DEFAULT_PALETTE_FAVOURITES]);
  });

  it('round-trips a stored list, preserving order', () => {
    const stored = JSON.stringify(['data:pie', 'shapes:star', 'tools:text']);
    expect(parseFavourites(stored, VALID)).toEqual(['data:pie', 'shapes:star', 'tools:text']);
  });

  it('accepts an empty stored list (everything removed) without falling back', () => {
    expect(parseFavourites('[]', VALID)).toEqual([]);
  });

  it('drops stale ids from a stored list', () => {
    const stored = JSON.stringify(['shapes:star', 'tools:retired-tile']);
    expect(parseFavourites(stored, VALID)).toEqual(['shapes:star']);
  });

  it('keeps dynamic icon/tech ids verbatim (their catalogues load async)', () => {
    const stored = JSON.stringify(['icon:database', 'tech:aws-lambda', 'shapes:star']);
    expect(parseFavourites(stored, VALID)).toEqual([
      'icon:database',
      'tech:aws-lambda',
      'shapes:star',
    ]);
  });

  it('collapses duplicates to the first occurrence', () => {
    const stored = JSON.stringify(['shapes:star', 'data:pie', 'shapes:star']);
    expect(parseFavourites(stored, VALID)).toEqual(['shapes:star', 'data:pie']);
  });

  it.each(['not json', '{"a":1}', '["ok", 3]', '3'])(
    'falls back to the defaults on corrupt value %j',
    (raw) => {
      expect(parseFavourites(raw, VALID)).toEqual([...DEFAULT_PALETTE_FAVOURITES]);
    },
  );

  it('filters defaults through validIds too, so a retired default cannot resurrect', () => {
    const withoutImage = new Set([...VALID].filter((id) => id !== 'tools:image'));
    expect(parseFavourites(null, withoutImage)).toEqual(
      DEFAULT_PALETTE_FAVOURITES.filter((id) => id !== 'tools:image'),
    );
  });
});
