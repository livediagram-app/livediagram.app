import { useEffect } from 'react';
import type { Element } from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';

// An element dialog (the link picker, the cell link picker, line data, code, Sankey Flows, Sequence, the image
// picker; the action popovers) is open "for" an element id, and renders only while it can be shown for it: the
// element is on the active tab, of the kind the dialog edits, and this session may still use it. Whenever that stops
// being true (a collaborator deletes the element, an undo takes it away, the tab changes, the element or the session
// becomes read-only), the dialog is closed too, rather than left hidden with its id set, so it never reopens by
// itself when the element or the permission comes back.
//
// `shows` is the dialog's own render check, given the element; left out, being on the tab is enough. The check runs
// after each commit that changes the elements or the open ids (or what `key` adds for a permission).
export type DialogFor = readonly [
  openForId: string | null,
  close: () => void,
  shows?: (el: Element) => boolean,
];

export function useCloseVanishedDialogs(
  elements: readonly Element[],
  dialogs: readonly DialogFor[],
  // Anything else the `shows` checks read (a read-only flag, a role), so a change to it re-checks.
  gate: string = '',
): void {
  const open = dialogs.filter(([id]) => id !== null);
  // Only the open ids drive the check, so an idle editor does nothing per elements change.
  const key = `${open.map(([id]) => id).join('\n')}|${gate}`;
  useEffect(() => {
    for (const [id, close, shows] of open) {
      // One lookup per open dialog (there are a handful at most), not a set of every element per change.
      const el = elements.find((e) => e.id === id);
      if (el && (!shows || shows(el))) continue;
      debugLog('[element-dialog] closed: cannot show', { id, gone: !el });
      close();
    }
    // `open` is rebuilt every render; `key` names what it holds.
    // oxlint-disable-next-line react-hooks-js/exhaustive-deps
  }, [elements, key]);
}
