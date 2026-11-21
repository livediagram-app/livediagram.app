// The open page's Title as it is being typed (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Name"): the
// page tree names the page from it as each key lands, before the writing commits and the stored name follows
// (usePageNameFromTitle). Set only by an Editor's own Title edit (the writing's dispatch), kept current by any later
// change to the writing (a peer's, an undo), and cleared when another page opens. Null while the Title has not been
// edited here: the tree shows the stored name.
import { useSyncExternalStore } from 'react';
import type { Node as PMNode } from 'prosemirror-model';
import { truncateName } from '@liveknowledge/document';
import { myEditingPage } from '@/lib/page-edit/page-edit-store';

let live: string | null = null;
const listeners = new Set<() => void>();
const set = (next: string | null) => {
  if (next === live) return;
  live = next;
  listeners.forEach((l) => l());
};

/** The Title's text in the writing's document: its first top-level Title paragraph, capped as a name is; null with
 *  none. Reads the top level only, so a keystroke costs a look at the first few blocks. */
export function titleTextOf(doc: PMNode): string | null {
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    if (node.type.name === 'paragraph' && node.attrs.style === 'title')
      return truncateName(node.textContent);
  }
  return null;
}

/** An Editor typed in the Title: the tree follows it. */
export function noteLivePageTitle(text: string): void {
  // In edit mode the Title is the draft's: the tree keeps the saved name until Save (editing.md "Save").
  if (myEditingPage() !== null) return;
  set(text);
}

/** The writing changed some other way (a peer, an undo, the page's writing arriving): a live title follows it. */
export function followLivePageTitle(text: string | null): void {
  if (live !== null) set(text ?? '');
}

/** Another page opened, or the editor closed: the tree shows stored names again. */
export function clearLivePageTitle(): void {
  set(null);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The live title for the open page's row; null for any other row, so typing renders that one row alone. */
export function useLivePageTitle(current: boolean): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (current ? live : null),
    () => null,
  );
}
