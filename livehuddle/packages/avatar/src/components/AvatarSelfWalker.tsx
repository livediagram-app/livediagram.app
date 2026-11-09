'use client';

// Your own character, subscribed to the walk's pose store (docs/specs/008-canvas/canvas-performance.md "Walking
// renders the characters, not the canvas"; blueprint: avatar-pose-store.md): a step renders this and the sprite, and
// nothing around it. What changes rarely (the costume, the seat, the drink, the status, the ring) comes in as props.
import type { ReactNode } from 'react';
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import { useAvatarPose } from '../hooks/useAvatarPose';
import { poseFeet, type AvatarPose } from '../pose';
import type { AvatarPoint } from '../walk';
import { AvatarWalker } from './AvatarWalker';

type WalkerProps = Parameters<typeof AvatarWalker>[0];
type FromPose = 'pos' | 'facing' | 'walking' | 'stepFrame' | 'lift' | 'wave' | 'pose';

const whole = (pose: AvatarPose) => pose;

export function AvatarSelfWalker({
  poseStore,
  ...rest
}: { poseStore: ReadableStore<AvatarPose> } & Omit<WalkerProps, FromPose | 'self'>) {
  const { pos, facing, walking, stepFrame, lift, wave, pose } = useAvatarPose(poseStore, whole);
  if (!pos) return null;
  return (
    <AvatarWalker
      {...rest}
      pos={pos}
      facing={facing}
      walking={walking}
      stepFrame={stepFrame}
      lift={lift}
      wave={wave}
      pose={pose}
      self
    />
  );
}

// Something drawn at your character's feet (a burst it throws), following it as it walks: only this renders for a
// step. Nothing while the character is not placed.
export function AvatarAtFeet({
  poseStore,
  children,
}: {
  poseStore: ReadableStore<AvatarPose>;
  children: ReactNode;
}) {
  const feet = useAvatarPose(poseStore, poseFeet);
  if (!feet) return null;
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        transform: `translate(${feet.x}px, ${feet.y}px)`,
      }}
    >
      {children}
    </div>
  );
}

const noFeet = (): AvatarPoint | null => null;

// Your feet handed to what is drawn from them only while `follow` is on (the speech composer above your head while
// it is open): closed, a step renders nothing here.
export function WithAvatarFeet({
  poseStore,
  follow,
  children,
}: {
  poseStore: ReadableStore<AvatarPose>;
  follow: boolean;
  children: (feet: AvatarPoint | null) => ReactNode;
}) {
  const feet = useAvatarPose(poseStore, follow ? poseFeet : noFeet);
  return children(feet);
}
