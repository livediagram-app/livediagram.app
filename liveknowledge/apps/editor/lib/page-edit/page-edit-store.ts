// Who is editing which page (docs/specs/030-knowledgebase/editing.md "Edit mode"; blueprint "Domain and naming"): this
// editor's own edit mode, and the others' from the room's roster (each session's `editing`, page-editing presence op).
// Outside React so the room's handlers write it without a render of the editor, and the few things that show it (the
// draft bar, the meta row's note, a peer's caret) read it by selector.
import { useSyncExternalStore } from 'react';

/** A person editing a page, as the roster names them. */
export type PageEditor = { id: string; name: string; color: string; picture?: string };

type RosterEntry = {
  id: string;
  name?: unknown;
  color?: unknown;
  picture?: unknown;
  editing?: unknown;
};

let mine: string | null = null;
// Every other session's editing page, by presence id, and its person.
let others = new Map<string, { tabId: string; who: PageEditor }>();
const names = new Map<string, string>();
const listeners = new Set<() => void>();
const saveListeners = new Set<(tabId: string, name: string) => void>();
const emit = () => listeners.forEach((l) => l());

/** This editor entered edit mode on a page, or left it (null). */
export function setMyEditingPage(tabId: string | null): void {
  if (mine === tabId) return;
  mine = tabId;
  emit();
}

export const myEditingPage = (): string | null => mine;

/** The room's roster (everyone but this session): who is editing what, and each person's name. */
export function notePageEditors(roster: readonly RosterEntry[]): void {
  const next = new Map<string, { tabId: string; who: PageEditor }>();
  names.clear();
  for (const p of roster) {
    const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Guest';
    names.set(p.id, name);
    if (typeof p.editing !== 'string' || !p.editing) continue;
    const who: PageEditor = {
      id: p.id,
      name,
      color: typeof p.color === 'string' ? p.color : '',
      ...(typeof p.picture === 'string' ? { picture: p.picture } : {}),
    };
    next.set(p.id, { tabId: p.editing, who });
  }
  const same =
    next.size === others.size &&
    [...next].every(([id, e]) => {
      const was = others.get(id);
      return (
        was && was.tabId === e.tabId && was.who.name === e.who.name && was.who.color === e.who.color
      );
    });
  if (same) return;
  others = next;
  emit();
}

/** Forget everyone (the room closed). */
export function clearPageEditors(): void {
  if (others.size === 0) return;
  others = new Map();
  emit();
}

const editorsCache = new Map<string, { key: string; list: PageEditor[] }>();

/** The others editing a page, in roster order; the same array while they are the same people. */
export function pageEditorsOf(tabId: string): PageEditor[] {
  const list = [...others.values()].filter((e) => e.tabId === tabId).map((e) => e.who);
  const key = list.map((w) => `${w.id}\u0000${w.name}\u0000${w.color}`).join('\u0001');
  const cached = editorsCache.get(tabId);
  if (cached && cached.key === key) return cached.list;
  editorsCache.set(tabId, { key, list });
  return list;
}

/** Whether the peer with this presence id is editing that page. */
export const peerEditing = (presenceId: string, tabId: string): boolean =>
  others.get(presenceId)?.tabId === tabId;

/** A peer saved a page (the page-saved presence op): told to whoever listens, with the peer's roster name. */
export function notePeerSaved(presenceId: string, tabId: string): void {
  const name = names.get(presenceId) ?? 'Guest';
  saveListeners.forEach((l) => l(tabId, name));
}

export function onPeerSaved(listener: (tabId: string, name: string) => void): () => void {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The others editing a page, re-rendering only when they change. */
export function usePageEditors(tabId: string): PageEditor[] {
  return useSyncExternalStore(
    subscribe,
    () => pageEditorsOf(tabId),
    () => EMPTY,
  );
}

/** The page this editor is editing, or null. */
export function useMyEditingPage(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => mine,
    () => null,
  );
}

const EMPTY: PageEditor[] = [];

// Leaving a page being edited (docs/specs/030-knowledgebase/editing.md "Leaving with unsaved changes"): the editing
// hook registers what to ask; every way to another page goes through leavePageThen.
type LeaveGuard = (to: string, go: () => void) => void;
let leaveGuard: LeaveGuard | null = null;

/** The editing hook's question before leaving, or null when it unmounts. */
export function setLeaveGuard(guard: LeaveGuard | null): void {
  leaveGuard = guard;
}

/** Runs `go` (opening page `to`) once this editor may leave the page it is editing: at once when it is editing
 *  nothing, or nothing unsaved; else after the person saves. */
export function leavePageThen(to: string, go: () => void): void {
  if (leaveGuard && mine !== null && mine !== to) leaveGuard(to, go);
  else go();
}
