// The bottom-right cluster's Problems on a Form tab (docs/specs/030-forms/forms.md "Publishing and the form link"):
// while an Editor has a Form tab open with something standing between it and its responses, the cluster shows
// Problems left of Style, and its popover lists them. The Form page says what they are and how each is fixed; the
// cluster (CanvasChrome) draws the button. A module store, as form-share-store.ts is.
import { useSyncExternalStore } from 'react';
import type { DestinationProblem, PublishProblem } from '@liveplanner/forms';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type FormProblemsHost = {
  problem: DestinationProblem | null;
  notReady: readonly PublishProblem[];
  warnings: readonly string[];
  onFixDestination: () => void;
  onShow: (problem: PublishProblem) => void;
};

let host: FormProblemsHost | null = null;
const listeners = createListeners();

/** The open Form page's problems (null when it goes, has none, or may not edit). */
export function setFormProblemsHost(next: FormProblemsHost | null): void {
  if (next === host) return;
  host = next;
  listeners.notify();
}

/** The open Form page's problems, or null. */
export function useFormProblemsHost(): FormProblemsHost | null {
  return useSyncExternalStore(
    listeners.subscribe,
    () => host,
    () => null,
  );
}
