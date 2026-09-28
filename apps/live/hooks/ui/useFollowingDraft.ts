import { useState, type Dispatch, type SetStateAction } from 'react';

// A local draft of a value that also changes from outside (a peer's edit, an undo, another element
// selected): the draft is edited freely, and replaced whenever the source itself changes. Adjusted during
// render, so a replaced draft never shows for a frame (docs/specs/003-system-architecture/
// react-state-and-effects.md). Sources compare with Object.is: pass a stable value (a memoised array, or a
// string key built from what should reset the draft).
export function useFollowingDraft<S>(source: S): [S, Dispatch<SetStateAction<S>>];
export function useFollowingDraft<S, D>(
  source: S,
  toDraft: (source: S) => D,
): [D, Dispatch<SetStateAction<D>>];
export function useFollowingDraft<S, D>(
  source: S,
  toDraft: (source: S) => D = (s) => s as unknown as D,
): [D, Dispatch<SetStateAction<D>>] {
  const [draft, setDraft] = useState(() => toDraft(source));
  const [followed, setFollowed] = useState(source);
  if (!Object.is(source, followed)) {
    setFollowed(source);
    setDraft(toDraft(source));
  }
  return [draft, setDraft];
}
