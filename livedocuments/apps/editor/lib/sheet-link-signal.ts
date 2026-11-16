// The room's `source-changed` frame (liveworkspace/docs/specs/004-index/sheet-sources.md "Keeping in step"), from the
// room connection to the linked charts that read the changed Sheets. A module-level relay: the room connection and
// the charts' reader sit far apart in the tree, and the frame carries ids only.
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type SourceChangedSignal = { app: string; itemId: string; sheetIds: string[] };

let last: SourceChangedSignal | null = null;
const listeners = createListeners();

export function emitSourceChanged(signal: SourceChangedSignal): void {
  last = signal;
  listeners.notify();
}

// Calls `onChange` with each frame from now on; answers the unsubscribe.
export function onSourceChanged(onChange: (signal: SourceChangedSignal) => void): () => void {
  return listeners.subscribe(() => {
    if (last) onChange(last);
  });
}
