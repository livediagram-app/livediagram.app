// Peers' cursors, held apart from the editor's render state (docs/specs/008-canvas/canvas-performance.md "A
// collaborator moving renders what shows them, not the editor"; blueprint: peer-motion-store.md). The presence
// coalescer writes them once a frame; the cursor layer subscribes. The editor root never reads them, so a frame of
// movement renders neither the root nor the chrome under its context.
import { createStateStore, type StateStore } from '@liveworkspace/workbench/lib/state-store';
import type { Participant } from '@/lib/identity';

/** A peer's cursor in canvas coordinates on a tab; null once it left the canvas. */
export type CursorPos = { tabId: string; x: number; y: number } | null;

export type PeerMotion = { cursors: StateStore<Map<string, CursorPos>> };

/** One per editor: made once by usePresenceState and handed on by identity. */
export function createPeerMotion(): PeerMotion {
  return { cursors: createStateStore<Map<string, CursorPos>>(new Map()) };
}

/**
 * What the cursor layer draws peers from: the moving store, and the coarse facts it is joined with (who is in the
 * room, who we are, the tab on screen, whether a vote hides cursors). Built by value at the root, so it changes only
 * when one of those does, never for a frame of movement.
 */
export type PeerRowsSource = {
  motion: PeerMotion;
  livePresenceById: Map<string, Participant>;
  selfId: string;
  activeId: string;
  cursorsHidden: boolean;
};
