import type { UserPreferences } from './user-preferences';

// The UI Scale sliders' live preview (docs/specs/007-editor/ui-scale.md "In
// Settings"): the patch the slider under the thumb would write, held while it
// is dragged so the chrome resizes as you go, without writing (and PUTting)
// the preference per step. Null when nothing is being dragged. Never persisted.

type Listener = () => void;

let preview: Partial<UserPreferences> | null = null;
const listeners = new Set<Listener>();

export function getUiScalePreview(): Partial<UserPreferences> | null {
  return preview;
}

export function setUiScalePreview(next: Partial<UserPreferences> | null): void {
  if (next === preview) return;
  preview = next;
  for (const listener of listeners) listener();
}

export function subscribeUiScalePreview(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
