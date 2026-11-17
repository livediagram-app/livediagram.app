'use client';

// The slot a tool's dialog renders into, in place of a modal (liveworkspace/docs/specs/004-index/footer-tools-menu.md
// "Opening a tool inside Tools"; blueprint FM6). The footer's Tools opens it just before a row's press opens that
// tool's dialog; the first Dialog that opens after it claims it and draws inside Tools: no backdrop, no focus trap, no
// Escape of its own. One slot at a time, held outside React so a dialog anywhere in the page (a host far from the
// footer) can find it.
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { DialogSize } from './Dialog';

/** What a claiming dialog hands the slot's host: its width, and its own ways out. */
export type ClaimedDialog = {
  size: DialogSize;
  /** The dialog's own close (asking `beforeClose` first), as its close button would. */
  close: () => void;
  /** Escape, as the dialog would take it (nothing while `closeOnEscape` is off). */
  escape: () => void;
};

export type DialogSlot = {
  /** Which opening this is: a dialog claims only the slot opened before it opened. */
  seq: number;
  /** Where the dialog renders, once the host has drawn it. */
  node: HTMLElement | null;
  /** The claiming dialog (an opaque token), or null while the slot waits. */
  owner: object | null;
  claimed: ClaimedDialog | null;
  /** The claimer let go (it closed itself): the host goes back. */
  released: boolean;
  /** Kept for the dialog that follows this one (a gate's Sync going on to its tool): its letting go is not the end. */
  held: boolean;
  /** Its dialog left for the whole window: Tools closes rather than going back. */
  leaving?: boolean;
};

let slot: DialogSlot | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function set(next: DialogSlot | null): void {
  slot = next;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Opens a fresh slot for the dialog about to open (any earlier one is dropped). */
export function openDialogSlot(): number {
  seq += 1;
  set({ seq, node: null, owner: null, claimed: null, released: false, held: false });
  return seq;
}

/** The host drew (or dropped) the node the dialog renders into. */
export function setDialogSlotNode(at: number, node: HTMLElement | null): void {
  if (slot?.seq !== at || slot.node === node) return;
  set({ ...slot, node });
}

/** The host is done with it (back to the list, or Tools closed). */
export function closeDialogSlot(at: number): void {
  if (slot?.seq === at) set(null);
}

/** The slot a dialog opening now would take (its number), or 0: one waiting, or one held for what follows. */
export function openSlotSeq(at: DialogSlot | null): number {
  return at && (at.held || (!at.owner && !at.released)) ? at.seq : 0;
}

/** Whether the slot `at` is still this dialog's (or still there for it to take). */
export function slotIsFor(at: DialogSlot | null, seqAt: number, owner: object): boolean {
  if (!at || at.seq !== seqAt) return false;
  if (at.owner === owner || at.held) return true;
  return at.owner === null && !at.released;
}

export function claimDialogSlot(at: number, owner: object, claimed: ClaimedDialog): boolean {
  if (!slot || !slotIsFor(slot, at, owner)) return false;
  if (slot.owner === owner && slot.claimed === claimed) return true;
  set({ ...slot, owner, claimed, released: false, held: false });
  return true;
}

export function releaseDialogSlot(owner: object): void {
  if (slot?.owner !== owner) return;
  set({ ...slot, owner: null, claimed: null, released: true });
}

/** A gate in Tools about to sync keeps the slot for the tool it goes on to, which opens in its place (held from before
 *  the sync, since the host may swap the gate for the tool before the sync's promise settles). Gives back the undo, for
 *  a sync that failed. Nothing outside Tools. */
export function holdDialogSlot(): () => void {
  const at = slot;
  if (!at?.owner || at.held) return () => {};
  set({ ...at, held: true });
  return () => {
    if (slot?.seq === at.seq && slot.held && slot.owner === at.owner) set({ ...slot, held: false });
  };
}

/** The dialog in Tools is about to close for something that takes the whole window (Version History): Tools closes
 *  with it rather than going back to its list. Nothing outside Tools. */
export function leaveToolsWithDialog(): void {
  if (slot?.owner && !slot.leaving) set({ ...slot, held: false, leaving: true });
}

export function useDialogSlot(): DialogSlot | null {
  return useSyncExternalStore(
    subscribe,
    () => slot,
    () => null,
  );
}

/** For tests: drops any slot. */
export function resetDialogSlot(): void {
  set(null);
}

// Whether this subtree is a dialog drawn inside Tools: its header draws no title band and no close (the back bar names
// the tool and closes it). A dialog opened inside it resets this for its own subtree.
export const DialogInlineContext = createContext(false);

export function useDialogInline(): boolean {
  return useContext(DialogInlineContext);
}
