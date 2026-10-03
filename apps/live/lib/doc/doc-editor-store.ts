'use client';

// The document being written in right now (docs/specs/007-editor/document-pages.md "The page
// toolbar"): which document's writing has the caret, on which of its pages, what the selection is
// formatted as, and a handle to run commands on it. One at a time; the page toolbar and the
// palette read it, the writing (DocumentFlowEditor) writes it.
import { useSyncExternalStore } from 'react';
import type { Command } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { DocSelectionState } from './doc-commands';

export type DocEditorHandle = {
  flow: string;
  // Runs a command on the writing, keeping the caret in it.
  run: (command: Command) => boolean;
  // Whether a command applies to the selection now.
  can: (command: Command) => boolean;
  // Blocks put after the block the caret is in.
  insert: (nodes: PMNode[]) => void;
  // Writes what is typed to the tab now, ahead of the idle commit.
  flush: () => void;
  focus: () => void;
  // The caret's place on screen, for a popover under it (a link field).
  caretRect: () => DOMRect | null;
  // How many words the writing holds, and how many of them are selected.
  words: () => { total: number; selected: number };
};

export type ActiveDoc = {
  handle: DocEditorHandle;
  // The page the caret is on.
  pageId: string | null;
  selection: DocSelectionState;
};

let active: ActiveDoc | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function setActiveDoc(next: ActiveDoc | null): void {
  if (active === next) return;
  active = next;
  emit();
}

/** Clears the active document only when it is still `flow`'s (a blur racing another's focus). */
export function clearActiveDoc(flow: string): void {
  if (active?.handle.flow !== flow) return;
  active = null;
  emit();
}

export function getActiveDoc(): ActiveDoc | null {
  return active;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useActiveDoc(): ActiveDoc | null {
  return useSyncExternalStore(subscribe, getActiveDoc, () => null);
}
