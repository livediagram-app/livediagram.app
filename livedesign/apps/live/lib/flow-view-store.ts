// Whether the Flow view is on (docs/specs/007-editor/wireframe-pages.md "Flow view"): one per browser tab, off on load,
// never stored or sent. The cluster button and the command palette both flip it; the canvas draws it on a wireframe
// tab.
import { useSyncExternalStore } from 'react';
import { track } from '@/lib/telemetry';

let on = false;
const listeners = new Set<() => void>();

export function flowViewOn(): boolean {
  return on;
}

/** Turns the Flow view on or off, telling telemetry first so the event goes whichever way it flips. */
export function toggleFlowView(): void {
  track('UI', 'Toggled', on ? 'FlowViewOff' : 'FlowViewOn');
  on = !on;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFlowView(): boolean {
  return useSyncExternalStore(subscribe, flowViewOn, () => false);
}
