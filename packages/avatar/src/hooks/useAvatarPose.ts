'use client';

// A by-value slice of your character's pose (blueprint: avatar-pose-store.md): the reader renders only when what it
// selected changes, so a fact about where you stand (the stage you speak from) renders on a change of that fact and
// never for a step.
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import type { AvatarPose } from '../pose';

export function useAvatarPose<T>(
  store: ReadableStore<AvatarPose>,
  select: (pose: AvatarPose) => T,
  equal?: (a: T, b: T) => boolean,
): T {
  return useStoreSlice(store, select, equal);
}
