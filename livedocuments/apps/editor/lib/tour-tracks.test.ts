// A tour of several tracks offers each once (lib/tour-tracks.ts, docs/specs/007-editor/user-preferences.md "Tours").
import { describe, expect, it } from 'vitest';
import { markPagesKindSeen, pagesKindSeen } from './pages-tour';
import { tourTrackSeen, withTracksAnswered } from './tour-tracks';

describe('tour tracks', () => {
  it('counts a track seen once answered', () => {
    expect(tourTrackSeen(['a'], undefined, 'a')).toBe(true);
    expect(tourTrackSeen(['a'], undefined, 'b')).toBe(false);
    expect(tourTrackSeen(undefined, undefined, 'a')).toBe(false);
  });

  it('reads the single flag as every track', () => {
    expect(tourTrackSeen(undefined, true, 'a')).toBe(true);
    expect(tourTrackSeen(undefined, false, 'a')).toBe(false);
  });

  it('adds each answered track once, in order', () => {
    expect(withTracksAnswered(['b'], ['a', 'b'])).toEqual(['b', 'a']);
    expect(withTracksAnswered(undefined, ['a'])).toEqual(['a']);
  });
});

describe('the Pages tour’s tracks', () => {
  it('offers Article after Slides is answered, and nothing once both are', () => {
    const slides = markPagesKindSeen({}, 'slide');
    expect(pagesKindSeen(slides, 'slide')).toBe(true);
    expect(pagesKindSeen(slides, 'article')).toBe(false);
    expect(pagesKindSeen(markPagesKindSeen(slides, 'article'), 'article')).toBe(true);
  });

  it('counts the single seen flag as no kind', () => {
    expect(pagesKindSeen({ pagesTourSeen: true }, 'slide')).toBe(false);
  });
});
