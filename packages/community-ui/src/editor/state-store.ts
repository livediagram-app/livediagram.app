import { useSyncExternalStore } from 'react';
import type { CommunityPostState } from '@liveworkspace/community';

// Whether each open item has a Community post, and in which state (liveworkspace/docs/specs/007-community/
// community.md), as an external store: seeded from the item's fetch, updated by the Share dialog's Community tab
// when the owner publishes or removes, and read by the editor header's visibility badge. A store rather than editor
// state so the badge follows a publish without threading it through the editor's state slices.

const states = new Map<string, CommunityPostState | null>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCommunityState(itemId: string, state: CommunityPostState | null): void {
  if (states.get(itemId) === state) return;
  states.set(itemId, state);
  for (const listener of listeners) listener();
}

export function getCommunityState(itemId: string | null): CommunityPostState | null {
  return itemId ? (states.get(itemId) ?? null) : null;
}

export function useCommunityState(itemId: string | null): CommunityPostState | null {
  return useSyncExternalStore(
    subscribe,
    () => getCommunityState(itemId),
    () => null,
  );
}

// Whether the editor header reads "Public": for the owner, while their post is listed and the Community is on; for
// anyone who came in through the post's link, always, since the server only resolves that link while the post is
// public.
export function itemIsPublic(input: {
  communityOn: boolean;
  ownPostState: CommunityPostState | null;
  communitySession: boolean;
}): boolean {
  return (input.communityOn && input.ownPostState === 'listed') || input.communitySession;
}
