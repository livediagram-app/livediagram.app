// The room's `source-changed` frame (liveworkspace/docs/specs/004-index/sheet-sources.md "Keeping in step"), from an
// editor's room connection to the linked charts that read the changed Sheets. A module-level relay: the room connection
// and the charts' reader sit far apart in the tree, and the frame carries ids only. One editor runs per page, so one
// relay serves it whatever its product.
export type SourceChangedSignal = { app: string; itemId: string; sheetIds: string[] };

const listeners = new Set<(signal: SourceChangedSignal) => void>();

export function emitSourceChanged(signal: SourceChangedSignal): void {
  // A snapshot: a listener that unsubscribes while being told is not told twice.
  for (const onChange of [...listeners]) onChange(signal);
}

// Calls `onChange` with each frame from now on; answers the unsubscribe.
export function onSourceChanged(onChange: (signal: SourceChangedSignal) => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
