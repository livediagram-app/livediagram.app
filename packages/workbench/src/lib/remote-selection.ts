// A peer's selection as the badges and the selection lock read it, in every editor
// (docs/specs/007-editor/editor-app.md "The whole selection holds"; livedesign's is live-app.md).
//
// `tabId` is optional for wire compatibility: an older peer's frame omits it and is read as tab-unknown, shown
// everywhere. `elementIds` is the peer's whole selection (a marquee or shift multi-selection holds every element in
// it), and the elements they let go of whose change has not landed yet (selection-write-hold.ts), which have no
// primary element; absent on an older peer's frame, which holds its single `elementId`.
export type RemoteSelection = { elementId: string | null; tabId?: string; elementIds?: string[] };

/** A peer's `select` op as a RemoteSelection. The op is another client's, so `elementIds` is kept only as strings and
 *  capped at `maxIds`, as the sender caps it. */
export function remoteSelectionOf(
  op: { elementId: string | null; tabId?: string; elementIds?: unknown },
  maxIds: number,
): RemoteSelection {
  const ids = Array.isArray(op.elementIds)
    ? op.elementIds.filter((id): id is string => typeof id === 'string').slice(0, maxIds)
    : [];
  return {
    elementId: op.elementId,
    tabId: op.tabId,
    ...(ids.length > 0 ? { elementIds: ids } : {}),
  };
}

/** Every element a peer's selection holds: its `elementIds`, else its single `elementId`, else none. */
export function heldElementIds(selection: RemoteSelection): readonly string[] {
  if (selection.elementIds?.length) return [...new Set(selection.elementIds)];
  return selection.elementId ? [selection.elementId] : [];
}
