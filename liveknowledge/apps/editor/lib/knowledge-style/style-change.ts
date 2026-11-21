// Changing the Knowledgebase Style from anywhere in the editor (the dialog, an undo): one door, bound by the
// editor's slice (app/document/[id]/editor-state/useEditorKnowledgeStyle.ts) while a knowledgebase an Editor may
// style is open, and unbound otherwise, so a Participant's or a Viewer's session has nothing to call.
import { useSyncExternalStore } from 'react';
import type { KnowledgeStyle } from '@liveknowledge/document';

export type StyleChange = (next: KnowledgeStyle) => void;

let bound: StyleChange | null = null;

const listeners = new Set<() => void>();

export function bindStyleChange(change: StyleChange | null): void {
  const was = bound !== null;
  bound = change;
  if (was !== (change !== null)) listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether this session may change the style: the door is bound. For a reader outside the editor's store (the
 *  command search), which lists Knowledgebase Style from it. */
export function useStyleChangeBound(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => bound !== null,
    () => false,
  );
}

/** Whether this session may change the style now, for a caller outside React (the dialog's preview). */
export const styleChangeBound = (): boolean => bound !== null;

/** Set the open knowledgebase's style: shown at once, saved, one undo step. False when this session may not. */
export function changeKnowledgeStyle(next: KnowledgeStyle): boolean {
  if (!bound) return false;
  bound(next);
  return true;
}
