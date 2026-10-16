// The header's Share on a Form tab (docs/specs/030-forms/forms.md "Publishing and the form link"): while an Editor has
// a Form tab open, the header's Share button is the form's Share Form, so the page never shows two share buttons. The
// Form page says it is there (and whether its link is published); the header asks it to open its dialog.
import { useSyncExternalStore } from 'react';

type FormShareHost = { published: boolean; open: () => void };

let host: FormShareHost | null = null;
const listeners = new Set<() => void>();

/** The open Form page takes the header's Share (null when it goes, or may not share). */
export function setFormShareHost(next: FormShareHost | null): void {
  if (next === host) return;
  host = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The Form page holding the header's Share, or null. */
export function useFormShareHost(): FormShareHost | null {
  return useSyncExternalStore(
    subscribe,
    () => host,
    () => null,
  );
}
