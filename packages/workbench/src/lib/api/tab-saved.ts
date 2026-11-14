// A landed save announced to the room (each product's docs/specs/006-*/delta-saves.md "A peer's save moves the base
// copy"): the revision it wrote and the digest of what is stored at it, when this editor holds that copy. Every
// editor's saveTabAndRelay calls it after relaying the save's element ops on the same socket, so every peer has
// applied them first, and before the save settles, so the tab's next save cannot relay its ops in between.
import type { TabSavedOp } from '@liveworkspace/api-schema/tab-delta';

type AnnounceRoom = { send: (msg: { kind: 'op'; op: TabSavedOp }) => void };

/** Sends `tab-saved` for a save of `tabId` that wrote `rev`. Never throws: an announcement is an optimisation, and a
 *  peer without one saves whole as before. */
export async function announceTabSave(
  tabId: string,
  rev: number,
  room: () => AnnounceRoom | null,
  digestOf: (tabId: string, rev: number) => Promise<string | null>,
): Promise<void> {
  if (!room()) return;
  try {
    const digest = await digestOf(tabId, rev);
    if (digest) room()?.send({ kind: 'op', op: { kind: 'tab-saved', tabId, rev, digest } });
  } catch {
    // Nothing announced.
  }
}
