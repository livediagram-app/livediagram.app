'use client';

import type { RefObject } from 'react';
import { useLatest } from '../ui/useLatest';

// Identity for /new's commit path (docs/specs/007-editor/new-document-route.md). The session's chunk loads
// deferred, so a fast click-through (or an e2e robot) can reach Create while `self` is still the 'pending'
// placeholder. Creating then would file the item under the literal owner "pending": a shared id every raced
// visitor collides on, and one the editor route (fetching with the real id) 404s. So the commit resolves identity
// itself: wait out the bootstrap (bounded: authLoaded flips by the 5 s auth timeout at the latest), then fall back
// to the guest's id from `ensureGuestIdentity`. A new function each render, as each page's own was, with the ref
// it reads, for a page that reads the newest self elsewhere too.
export function useResolveSelf<P extends { id: string }>(
  self: P,
  setSelf: (self: P) => void,
  ensureGuestIdentity: () => Promise<{ id: string }>,
): { resolveSelf: () => Promise<P>; selfRef: RefObject<P> } {
  const selfRef = useLatest(self);
  const resolveSelf = async (): Promise<P> => {
    const deadline = Date.now() + 8000;
    while (selfRef.current.id === 'pending' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (selfRef.current.id !== 'pending') return selfRef.current;
    // Still pending (auth never settled): resolve the guest's id here.
    const fallback = { ...selfRef.current, id: (await ensureGuestIdentity()).id };
    setSelf(fallback);
    return fallback;
  };
  return { resolveSelf, selfRef };
}
