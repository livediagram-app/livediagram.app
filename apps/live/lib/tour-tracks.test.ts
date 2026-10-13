// A tour of several tracks offers each once (lib/tour-tracks.ts, docs/specs/007-editor/user-preferences.md "Tours").
import { describe, expect, it } from 'vitest';
import { markPlanTracksSeen, planTourOwed, planTrackSeen } from './plan-tour';
import { tourTrackSeen, withTracksAnswered } from './tour-tracks';

describe('tour tracks', () => {
  it('counts a track seen once answered', () => {
    expect(tourTrackSeen({}, ['a'], undefined, 'a')).toBe(true);
    expect(tourTrackSeen({}, ['a'], undefined, 'b')).toBe(false);
    expect(tourTrackSeen(null, undefined, undefined, 'a')).toBe(false);
  });

  it('reads the old single flag as every track only while Power user mode is on', () => {
    expect(tourTrackSeen({}, undefined, true, 'a')).toBe(false);
    expect(tourTrackSeen({ powerUserMode: true }, undefined, true, 'a')).toBe(true);
    expect(tourTrackSeen({ powerUserMode: true }, undefined, false, 'a')).toBe(false);
  });

  it('adds each answered track once, in order', () => {
    expect(withTracksAnswered(['b'], ['a', 'b'])).toEqual(['b', 'a']);
    expect(withTracksAnswered(undefined, ['a'])).toEqual(['a']);
  });
});

describe('the Plan tour’s tracks', () => {
  it('offers Sheets after Boards is answered, and nothing once both are', () => {
    const boards = markPlanTracksSeen({}, ['boards']);
    expect(planTrackSeen(boards, 'boards')).toBe(true);
    expect(planTrackSeen(boards, 'sheets')).toBe(false);
    expect(planTourOwed(boards)).toBe(true);
    expect(planTourOwed(markPlanTracksSeen(boards, ['sheets']))).toBe(false);
  });

  it('offers both again to someone who answered the single Plan tour', () => {
    expect(planTourOwed({ planTourSeen: true })).toBe(true);
    expect(planTourOwed({ planTourSeen: true, powerUserMode: true })).toBe(false);
  });
});
