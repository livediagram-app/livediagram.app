import { useSyncExternalStore } from 'react';

// Presence on the tab beside (docs/specs/007-editor/split-view.md "Presence"): somebody working side
// by side has two tabs on screen, so they show on both tabs' pills. The tab they edit travels as
// `tab-focus`'s `tabId`, as ever; the other pane's tab rides beside it as `besideTabId`. Two small
// stores, kept apart from the editor's state: what this browser has beside it (set by the split
// frame, read by the presence broadcast), and what each peer has (set by the room connection, read
// by the tab bar's presence rows).

type Listener = () => void;

function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      for (const l of listeners) l();
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const local = createStore<string | null>(null);
const remote = createStore<ReadonlyMap<string, string>>(new Map());

// This browser's other pane, or null with no split showing.
export const setLocalBesideTab = (tabId: string | null) => local.set(tabId);

export function useLocalBesideTab(): string | null {
  return useSyncExternalStore(local.subscribe, local.get, () => null);
}

// A peer's other pane, from their `tab-focus` op: a tab id, or nothing (no split, or an older client).
export function setRemoteBesideTab(participantId: string, tabId: string | null | undefined): void {
  const current = remote.get();
  if ((current.get(participantId) ?? null) === (tabId ?? null)) return;
  const next = new Map(current);
  if (tabId) next.set(participantId, tabId);
  else next.delete(participantId);
  remote.set(next);
}

// The room's presence list: everyone present, each with the beside tab the room remembers (so a late
// joiner sees it too). Anyone absent from the list is dropped.
export function syncRemoteBesideTabs(
  participants: readonly { id: string; besideTabId?: string }[],
  selfId: string,
): void {
  const next = new Map<string, string>();
  for (const p of participants) if (p.id !== selfId && p.besideTabId) next.set(p.id, p.besideTabId);
  const current = remote.get();
  if (next.size === current.size && [...next].every(([id, tab]) => current.get(id) === tab)) return;
  remote.set(next);
}

const EMPTY: ReadonlyMap<string, string> = new Map();

export function useRemoteBesideTabs(): ReadonlyMap<string, string> {
  return useSyncExternalStore(remote.subscribe, remote.get, () => EMPTY);
}

// Tests, and leaving a document: start from nobody beside anything.
export function resetSplitPresence(): void {
  local.set(null);
  remote.set(new Map());
}
