'use client';

// The coarse copy's readers (docs/specs/008-canvas/canvas-performance.md "Walking renders the characters, not the
// canvas"; blueprint: peer-motion-store.md "The coarse copy"): the peers' characters and your feet for what follows
// positions as a fact, at most 10 times a second while people walk and at once when a fact changes.
import { useMemo } from 'react';
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import { joinStores, type ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import type { AvatarPose } from '@livehuddle/avatar/pose';
import type { AvatarPoint } from '@livehuddle/avatar/walk';
import { coarseStore } from '@/lib/coarse-store';
import { placeOf, type CallPlaces } from '@/lib/calls/call-places';
import type { PeerAvatar, PeerRowsSource } from '@/lib/peer-motion';
import type { RemoteAvatarRow } from '@/lib/presence-rows';
import { peerAvatarRowsOf } from './usePeerRows';

/** The peers' discrete facts: who is here, on which tab, sitting where, in which room and on which stage. */
export function peerFacts(avatars: ReadonlyMap<string, PeerAvatar>, places: CallPlaces): string {
  let facts = '';
  for (const [id, { tabId, avatar }] of avatars) {
    facts += `${id}|${tabId}|${avatar.seatedOn ?? ''}|${avatar.seat?.index ?? ''}|${placeOf(avatar, places)};`;
  }
  return facts;
}

/** Your feet's discrete facts: whether you are placed, and the room and stage you stand in. */
export function feetFacts(pose: AvatarPose, places: CallPlaces): string {
  return pose.pos ? placeOf(pose.pos, places) : 'away';
}

/** Everyone's facts as one string; each side's kept per snapshot, so a frame that moved only you tests no peer. */
function motionFacts(places: CallPlaces): (motion: Motion) => string {
  let peersSeen: Map<string, PeerAvatar> | null = null;
  let peersFacts = '';
  return ([avatars, pose]) => {
    if (avatars !== peersSeen) {
      peersSeen = avatars;
      peersFacts = peerFacts(avatars, places);
    }
    return `${peersFacts}#${feetFacts(pose, places)}`;
  };
}

type Motion = readonly [Map<string, PeerAvatar>, AvatarPose];
const feetOf = ([, pose]: Motion): AvatarPoint | null => pose.pos;

/**
 * The peers' characters on the active tab and your feet, as one coarse copy has them (one cadence for both, so a
 * reader of the two changes at most once an interval): the rows are the same array the frame-rate readers built for
 * that snapshot; your feet are null outside the mode.
 */
export function useCoarseMotion(
  peers: PeerRowsSource,
  poseStore: ReadableStore<AvatarPose>,
  places: CallPlaces,
): { remoteAvatars: RemoteAvatarRow[]; feet: AvatarPoint | null } {
  const store = useMemo(
    () =>
      coarseStore(joinStores(peers.motion.avatars, poseStore), { factsOf: motionFacts(places) }),
    [peers.motion.avatars, poseStore, places],
  );
  const selectRows = useMemo(
    () =>
      ([avatars]: Motion) =>
        peerAvatarRowsOf(peers, avatars),
    [peers],
  );
  return { remoteAvatars: useStoreSlice(store, selectRows), feet: useStoreSlice(store, feetOf) };
}
