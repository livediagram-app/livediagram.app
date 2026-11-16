// What the room tells an editor about suggestions (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md
// "Live"): a tab's suggestions changed (a system `suggestions` op, carrying no content, so a Viewer's socket learns
// nothing), and whether this session is on Suggest Only (a system `review` op to its socket alone). Each product's
// room-op receiver hands every system op here; the editor's suggestions hook listens. A small module-level bus: one
// editor is open per page.

/** The room's word that a tab's suggestions changed; editors that may see them read them again. */
export type SuggestionsRoomOp = { kind: 'suggestions'; tabId: string };

export const suggestionsRoomOp = (tabId: string): SuggestionsRoomOp => ({
  kind: 'suggestions',
  tabId,
});

const changed = new Set<(tabId: string) => void>();
const suggestOnlyListeners = new Set<() => void>();
let suggestOnly = false;

/** Take a system op if it is one of ours: true when it was (the caller stops there). */
export function takeSuggestionsRoomOp(op: unknown): boolean {
  const o = op as { kind?: unknown; tabId?: unknown; suggestOnly?: unknown } | null;
  if (!o || typeof o !== 'object') return false;
  if (o.kind === 'suggestions' && typeof o.tabId === 'string') {
    for (const l of changed) l(o.tabId);
    return true;
  }
  if (o.kind === 'review' && typeof o.suggestOnly === 'boolean') {
    setRoomSuggestOnly(o.suggestOnly);
    return true;
  }
  return false;
}

export function onSuggestionsChanged(listener: (tabId: string) => void): () => void {
  changed.add(listener);
  return () => void changed.delete(listener);
}

/** The room's word on this session: a Participant on Suggest Only always suggests. */
export function setRoomSuggestOnly(on: boolean): void {
  if (suggestOnly === on) return;
  suggestOnly = on;
  for (const l of suggestOnlyListeners) l();
}

export const roomSuggestOnly = (): boolean => suggestOnly;

export function onRoomSuggestOnly(listener: () => void): () => void {
  suggestOnlyListeners.add(listener);
  return () => void suggestOnlyListeners.delete(listener);
}
