'use client';

// The article being written in right now (docs/specs/007-editor/article-pages.md "The page
// toolbar"): which article's writing has the caret, on which of its pages, what the selection is
// formatted as, and a handle to run commands on it. One at a time; the page toolbar and the
// palette read it, the writing (ArticleEditor) writes it.
import { useSyncExternalStore } from 'react';
import type { Command } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { ArticleSelectionState } from './article-commands';

export type ArticleEditorHandle = {
  flow: string;
  // Runs a command on the writing, keeping the caret in it.
  run: (command: Command) => boolean;
  // Whether a command applies to the selection now.
  can: (command: Command) => boolean;
  // Blocks put after the block the caret is in.
  insert: (nodes: PMNode[]) => void;
  // Writes what is typed to the tab now, ahead of the idle commit.
  flush: () => void;
  // The editor's own history, as ⌘Z and ⇧⌘Z in the writing.
  undo: () => void;
  redo: () => void;
  focus: () => void;
  // The caret's place on screen, for a popover under it (a link field).
  caretRect: () => DOMRect | null;
  // A zone put into the writing at the block boundary nearest a canvas point (or after the block
  // the caret is in), the writing so far taken as written: its blocks, the zone's id, and where it
  // landed (its page by index among the article's pages, and its spot from that page's corner).
  insertZone: (
    spec: { zone: 'object' | 'drawing'; width: number; height: number },
    near: { x: number; y: number } | null,
  ) => {
    id: string;
    blocks: import('@livediagram/document').ArticleBlock[];
    index: number;
    x: number;
    y: number;
  } | null;
  // The block boundary nearest a canvas point (never beside the block `skipId`): its position in
  // the writing, and the drop caret for it, a line across the column in canvas px.
  boundaryNear: (
    near: { x: number; y: number },
    skipId: string | null,
  ) => { pos: number; caret: { x: number; y: number; width: number } } | null;
  // A zone moved to the block boundary nearest a canvas point, the writing so far taken as
  // written; where it landed, as insertZone says. Null when it would not move.
  moveZone: (
    id: string,
    near: { x: number; y: number },
  ) => {
    id: string;
    blocks: import('@livediagram/document').ArticleBlock[];
    index: number;
    x: number;
    y: number;
  } | null;
  // The caret put at the writing nearest a screen point (a press on the page's blank paper).
  focusAt: (clientX: number, clientY: number) => void;
  // The caret's place on the canvas (for an insert there).
  caretCanvasPoint: () => { x: number; y: number } | null;
  // The writing as laid out now, as draw operations in canvas coordinates (an export).
  snapshot: () => import('./article-snapshot').ArticleDrawOp[];
  // The writing as soft bars, one per line (a thumbnail, the Map).
  bars: (ink: string) => import('./article-snapshot').ArticleDrawOp[];
};

// Every article's editor on the tab, by flow: what an insert into an article that is not being
// written in reaches.
const handles = new Map<string, ArticleEditorHandle>();

export function registerArticleHandle(handle: ArticleEditorHandle): () => void {
  handles.set(handle.flow, handle);
  return () => {
    if (handles.get(handle.flow) === handle) handles.delete(handle.flow);
  };
}

export function articleHandleOf(flow: string): ArticleEditorHandle | undefined {
  return handles.get(flow);
}

export type ActiveArticle = {
  handle: ArticleEditorHandle;
  // The page the caret is on.
  pageId: string | null;
  selection: ArticleSelectionState;
};

let active: ActiveArticle | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function setActiveArticle(next: ActiveArticle | null): void {
  if (active === next) return;
  active = next;
  emit();
}

/** Clears the active article only when it is still `flow`'s (a blur racing another's focus). */
export function clearActiveArticle(flow: string): void {
  if (active?.handle.flow !== flow) return;
  active = null;
  emit();
}

export function getActiveArticle(): ActiveArticle | null {
  return active;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useActiveArticle(): ActiveArticle | null {
  return useSyncExternalStore(subscribe, getActiveArticle, () => null);
}

// Requests the page toolbar answers: ⌘K in the writing opens its link field; its Article style
// button asks the page's panel to open on Style. Counters, so the same request twice is two.
type Signal = { seq: number; pageId?: string };
let linkSignal: Signal = { seq: 0 };
let panelSignal: Signal = { seq: 0 };

export function requestArticleLink(): void {
  linkSignal = { seq: linkSignal.seq + 1 };
  emit();
}

export function requestStylePanel(pageId: string): void {
  panelSignal = { seq: panelSignal.seq + 1, pageId };
  emit();
}

export function useArticleLinkRequest(): number {
  return useSyncExternalStore(
    subscribe,
    () => linkSignal.seq,
    () => 0,
  );
}

export function useStylePanelRequest(): Signal {
  return useSyncExternalStore(
    subscribe,
    () => panelSignal,
    () => panelSignal,
  );
}
