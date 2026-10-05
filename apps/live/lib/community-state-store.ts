import { useSyncExternalStore } from 'react';
import type { CommunityPostState } from '@livediagram/api-schema';

// Whether each open document has a Community post, and in which state (docs/specs/025-community/community.md),
// as an external store (docs/specs/003-system-architecture/react-state-and-effects.md): seeded from the
// document fetch, updated by the Share dialog's Community section when the owner publishes or removes,
// and read by the header's visibility badge. A store rather than editor state so the badge follows a
// publish without threading it through the editor's state slices.

const states = new Map<string, CommunityPostState | null>();
const listeners = new Set<() => void>();

export function setCommunityState(documentId: string, state: CommunityPostState | null): void {
  if (states.get(documentId) === state) return;
  states.set(documentId, state);
  listeners.forEach((fn) => fn());
}

export function getCommunityState(documentId: string | null): CommunityPostState | null {
  return documentId ? (states.get(documentId) ?? null) : null;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useCommunityState(documentId: string | null): CommunityPostState | null {
  return useSyncExternalStore(
    subscribe,
    () => getCommunityState(documentId),
    () => null,
  );
}
