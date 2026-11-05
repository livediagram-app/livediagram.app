// A tour of several tracks offers each once (lib/tour-tracks.ts, docs/specs/007-editor/user-preferences.md "Tours").
import { describe, expect, it } from 'vitest';
import { markPlanTracksSeen, PLAN_TOUR_TRACKS, planTrackSeen } from './plan-tour';
import { withTracksAnswered } from './tour-tracks';
import { upgradeLegacyPreferences } from '@liveplanner/api-schema';

describe('tour tracks', () => {
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
    expect(planTrackSeen(markPlanTracksSeen(boards, ['sheets']), 'sheets')).toBe(true);
  });

  it('offers both again to someone who answered the single Plan tour', () => {
    expect(planTrackSeen({ planTourSeen: true }, 'boards')).toBe(false);
  });

  it('keeps every track seen for someone who had Power user mode on, as their blob is read', () => {
    // docs/specs/007-editor/power-user-mode.md "What happens to stored preferences".
    const prefs = upgradeLegacyPreferences({ powerUserMode: true, planTourSeen: true });
    expect(PLAN_TOUR_TRACKS.every((t) => planTrackSeen(prefs, t))).toBe(true);
  });
});
