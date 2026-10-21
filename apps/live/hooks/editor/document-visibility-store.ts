'use client';

// Who can see the open document, for the Explorer panel's Current Document card (docs/specs/013-workspace/
// explorer-structure.md "The editor's Explorer"): the same visibility the editor header's badge reads, published by
// the editor as it changes. A module store, like active-tab-name-store.ts, so the panel never re-renders for the
// editor's own churn and no prop runs through the chrome to reach it.
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { createListeners } from '@/lib/listeners';

type DocumentVisibility = {
  shareable: boolean;
  team: boolean;
  offline: boolean;
  // Opens Share: absent where the reader may not change who can see the document.
  onManage?: () => void;
};

let visibility: DocumentVisibility | null = null;
const listeners = createListeners();

export function setDocumentVisibility(next: DocumentVisibility | null): void {
  if (next === visibility) return;
  visibility = next;
  listeners.notify();
}

const get = () => visibility;
const none = () => null;
export function useDocumentVisibility(): DocumentVisibility | null {
  return useSyncExternalStore(listeners.subscribe, get, none);
}

// The editor's side: republished only when a field changes; Manage stays stable while its handler changes.
export function usePublishDocumentVisibility(
  shareable: boolean,
  team: boolean,
  offline: boolean,
  onManage: (() => void) | undefined,
): void {
  const manage = useLatest(onManage);
  const canManage = !!onManage;
  useLayoutEffect(() => {
    setDocumentVisibility({
      shareable,
      team,
      offline,
      ...(canManage ? { onManage: () => manage.current?.() } : {}),
    });
  }, [shareable, team, offline, canManage, manage]);
  useLayoutEffect(() => () => setDocumentVisibility(null), []);
}
