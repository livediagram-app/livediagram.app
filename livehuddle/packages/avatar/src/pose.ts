// Your character's pose from frame to frame (docs/specs/008-canvas/canvas-performance.md "Walking renders the
// characters, not the canvas"; blueprint: avatar-pose-store.md): what the sprite draws, held in a store the walk
// loop writes, so a step renders what subscribes to it and not the canvas that owns the walk.
import type { ReactionPose } from './reactions';
import type { AvatarFacing, AvatarPoint } from './walk';

export type AvatarPose = {
  // The feet in canvas px; null outside the mode.
  pos: AvatarPoint | null;
  facing: AvatarFacing;
  walking: boolean;
  // 0 / 1, the two-frame leg swing, advanced by distance walked.
  stepFrame: number;
  // Height above the ground mid-hop, canvas px.
  lift: number;
  // Flag-wave frame, or null when the flag is down.
  wave: number | null;
  // A reaction's pose in progress, or null.
  pose: ReactionPose | null;
};

export const NO_POSE: AvatarPose = {
  pos: null,
  facing: 'down',
  walking: false,
  stepFrame: 0,
  lift: 0,
  wave: null,
  pose: null,
};

const samePoint = (a: AvatarPoint | null, b: AvatarPoint | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y);

/** The pose with a frame's changes laid over it: the same pose when none of them changes anything. */
export function mergePose(prev: AvatarPose, patch: Partial<AvatarPose>): AvatarPose {
  let next: AvatarPose | null = null;
  for (const key of Object.keys(patch) as (keyof AvatarPose)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    const same =
      key === 'pos' ? samePoint(prev.pos, value as AvatarPoint | null) : prev[key] === value;
    if (same) continue;
    next ??= { ...prev };
    (next as Record<keyof AvatarPose, unknown>)[key] = value;
  }
  return next ?? prev;
}

/** The pose's feet, or null: the slice most readers take. */
export const poseFeet = (pose: AvatarPose): AvatarPoint | null => pose.pos;
/** Whether the character is walking: changes as it sets off and stops, never per step. */
export const poseWalking = (pose: AvatarPose): boolean => pose.walking;
/** Whether the character stands somewhere (in the mode, placed). */
export const posePlaced = (pose: AvatarPose): boolean => pose.pos !== null;
