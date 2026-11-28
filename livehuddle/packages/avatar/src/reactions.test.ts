import { describe, expect, it } from 'vitest';
import {
  AVATAR_HAND_UP_MS,
  AVATAR_REACTIONS,
  parseAvatarReactionKind,
  reactionDuration,
  reactionPose,
  type AvatarReactionKind,
} from './reactions';

const KINDS = AVATAR_REACTIONS.map((r) => r.id);

// Sample a reaction at 60fps and hand back every pose, so the tests can assert
// on the shape of the whole performance rather than one instant.
const play = (kind: AvatarReactionKind) => {
  const frames = [];
  for (let t = 0; t < reactionDuration(kind); t += 1000 / 60) frames.push(reactionPose(kind, t));
  return frames;
};

describe('reactionPose', () => {
  it('is standing (and done) before it starts and after it ends', () => {
    for (const kind of KINDS) {
      expect(reactionPose(kind, -1).done).toBe(true);
      expect(reactionPose(kind, reactionDuration(kind)).done).toBe(true);
      expect(reactionPose(kind, reactionDuration(kind) + 500)).toEqual(
        reactionPose(kind, reactionDuration(kind)),
      );
    }
  });

  it('is mid-performance (not done) throughout its window', () => {
    for (const kind of KINDS) {
      expect(play(kind).every((pose) => !pose.done)).toBe(true);
    }
  });

  it('never leaves the character underground', () => {
    for (const kind of KINDS) {
      expect(play(kind).every((pose) => pose.lift >= 0)).toBe(true);
    }
  });

  it('jumping jacks does five hops, with arms and legs opening at the top', () => {
    const frames = play('jumping-jacks');
    // Count reps by upward crossings of half height. (Counting `lift === 0`
    // frames doesn't work: at 60fps the samples almost never land exactly on a
    // rep boundary, so the character is never sampled at exactly zero.)
    const half = Math.max(...frames.map((f) => f.lift)) / 2;
    let reps = 0;
    for (let i = 1; i < frames.length; i += 1) {
      if (frames[i - 1]!.lift <= half && frames[i]!.lift > half) reps += 1;
    }
    expect(reps).toBe(5);
    // Arms out only ever coincides with being airborne.
    expect(frames.every((f) => !f.armsOut || f.lift > 0)).toBe(true);
    expect(frames.some((f) => f.armsOut && f.legsApart)).toBe(true);
  });

  it('spin turns through all four facings, twice round', () => {
    const facings = play('spin').map((f) => f.facing);
    expect(new Set(facings)).toEqual(new Set(['down', 'left', 'up', 'right']));
    // Two full turns = the sequence returns to 'down' at least once mid-way.
    const downs = facings.filter((f, i) => f === 'down' && facings[i - 1] !== 'down');
    expect(downs.length).toBe(2);
    expect(facings[0]).toBe('down');
  });

  it('wave keeps one arm up the whole time and swings it', () => {
    const frames = play('wave');
    expect(frames.every((f) => f.waveArm)).toBe(true);
    expect(new Set(frames.map((f) => f.leanX)).size).toBeGreaterThan(1);
  });

  it('cheer holds both arms up and bounces', () => {
    const frames = play('cheer');
    expect(frames.every((f) => f.armsUp)).toBe(true);
    expect(Math.max(...frames.map((f) => f.lift))).toBeGreaterThan(10);
  });

  it('dance sways both ways, alternating which arm is up', () => {
    const frames = play('dance');
    expect(frames.some((f) => f.leanX < 0)).toBe(true);
    expect(frames.some((f) => f.leanX > 0)).toBe(true);
    expect(frames.some((f) => f.waveArm)).toBe(true);
    expect(frames.some((f) => f.armsUp)).toBe(true);
  });

  it('never raises arms two ways at once (the sprite can only draw one)', () => {
    for (const kind of KINDS) {
      expect(
        play(kind).every((f) => [f.armsOut, f.armsUp, f.waveArm].filter(Boolean).length <= 1),
      ).toBe(true);
    }
  });
});

describe('reactionDuration', () => {
  it('keeps every reaction short enough to be a gesture, not a cutscene', () => {
    for (const kind of KINDS) {
      expect(reactionDuration(kind)).toBeGreaterThan(500);
      expect(reactionDuration(kind)).toBeLessThanOrEqual(2500);
    }
  });
});

// docs/specs/008-canvas/avatar-mode.md "The avatar palette": the four meeting Behaviours.
describe('the meeting Behaviours', () => {
  it('raises the right hand, alone, for a card and the preview', () => {
    expect(play('raise-hand').every((f) => f.handUp && !f.armsUp && !f.waveArm)).toBe(true);
  });

  it('claps six times, the hands meeting at the middle of each beat and apart between', () => {
    const frames = play('clap');
    const beats = frames.map((f) => f.clap ?? -1);
    expect(beats.every((b) => b >= 0 && b <= 1)).toBe(true);
    let meets = 0;
    for (let i = 1; i < beats.length - 1; i++)
      if (beats[i]! > 0.95 && beats[i]! >= beats[i - 1]! && beats[i]! >= beats[i + 1]!) meets++;
    expect(meets).toBe(6);
    expect(reactionPose('clap', 0).clap).toBe(0);
  });

  it('holds a thumbs up and a point the whole way, on the spot', () => {
    expect(play('thumbs-up').every((f) => f.thumbsUp && f.lift === 0 && !f.facing)).toBe(true);
    expect(play('point').every((f) => f.point && f.lift === 0 && !f.facing)).toBe(true);
  });

  it("leaves the first five's poses exactly as they were (no new fields on them)", () => {
    for (const kind of ['jumping-jacks', 'wave', 'spin', 'cheer', 'dance'] as const)
      for (const f of play(kind))
        expect(Object.keys(f).sort()).toEqual(
          ['armsOut', 'armsUp', 'done', 'legsApart', 'leanX', 'lift', 'waveArm', 'facing']
            .filter((k) => k !== 'facing' || f.facing !== undefined)
            .sort(),
        );
  });

  it('keeps a raised hand up two minutes unless lowered', () => {
    expect(AVATAR_HAND_UP_MS).toBe(120_000);
  });
});

describe('an unknown kind (a newer client)', () => {
  it('parses as null and poses as standing, never throwing', () => {
    expect(parseAvatarReactionKind('moonwalk')).toBeNull();
    expect(parseAvatarReactionKind(42)).toBeNull();
    expect(parseAvatarReactionKind('clap')).toBe('clap');
    const unknown = 'moonwalk' as AvatarReactionKind;
    expect(reactionDuration(unknown)).toBe(0);
    expect(reactionPose(unknown, 100).done).toBe(true);
  });
});
