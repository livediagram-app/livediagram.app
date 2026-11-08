// Peers' cursors and characters, held apart from the editor's render state (docs/specs/008-canvas/canvas-performance.md
// "A collaborator moving renders what shows them, not the editor"; blueprint: peer-motion-store.md). The presence
// coalescer writes them once a frame; the cursor layer and the canvas subscribe. The editor root never reads them, so a
// frame of movement renders neither the root nor the chrome under its context.
import { createStateStore, type StateStore } from '@liveworkspace/workbench/lib/state-store';
import type { AvatarPresence } from '@livehuddle/api-schema';
import type { Participant } from '@/lib/identity';

/** A peer's cursor in canvas coordinates on a tab; null once it left the canvas. */
export type CursorPos = { tabId: string; x: number; y: number } | null;
/** A peer's walking character as last seen (docs/specs/008-canvas/avatar-mode.md), costume filled back in. */
export type PeerAvatar = { tabId: string; avatar: AvatarPresence };

export type PeerMotion = {
  cursors: StateStore<Map<string, CursorPos>>;
  avatars: StateStore<Map<string, PeerAvatar>>;
};

/** One per editor: made once by usePresenceState and handed on by identity. */
export function createPeerMotion(): PeerMotion {
  return {
    cursors: createStateStore<Map<string, CursorPos>>(new Map()),
    avatars: createStateStore<Map<string, PeerAvatar>>(new Map()),
  };
}

/**
 * What the canvas draws peers from: the moving store, and the coarse facts it is joined with (who is in the room,
 * who we are, the tab on screen, each peer's tab). Built by value at the root, so it changes only when one of those
 * does, never for a frame of movement.
 */
export type PeerRowsSource = {
  motion: PeerMotion;
  livePresenceById: Map<string, Participant>;
  selfId: string;
  activeId: string;
  tabFocus: ReadonlyMap<string, string>;
};
