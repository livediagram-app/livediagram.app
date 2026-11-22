'use client';

// The open knowledgebase's page Trash as the editor last read it (docs/specs/030-knowledgebase/
// knowledgebases-and-pages.md "The page Trash"; blueprint page-tree.md "The page Trash"), and whether its dialog is
// open. One knowledgebase at a time: a session for another drops what was read. Read as the sidebar mounts and
// again TRASH_REFRESH_MS after the page count changes (the autosave's DELETEs have landed by then), never per render.
import { useSyncExternalStore } from 'react';
import type { PageRestoreResponse, TrashedPage } from '@liveknowledge/api-schema';
import {
  apiDeletePageForever,
  apiEmptyPageTrash,
  apiPageTrash,
  apiRestorePage,
} from '@/lib/api/page-trash';
import type { KnowledgeCaller } from '@/lib/api/knowledge';

/** After a change of the page count, how long before the Trash is read again (ms): past the autosave's 600 ms and
 *  its DELETEs, before a person looks. */
export const TRASH_REFRESH_MS = 1500;

/** Who reads the Trash, and of which knowledgebase. */
export type TrashSession = { documentId: string; who: KnowledgeCaller };

export type PageTrashState = {
  documentId: string | null;
  pages: TrashedPage[];
  /** Read at least once for this knowledgebase. */
  loaded: boolean;
  /** The last read failed, and nothing was read before it. */
  failed: boolean;
  /** The dialog is open; `focus` is the page its row marks (a link to a trashed page opened it). */
  open: boolean;
  focus: string | null;
};

const EMPTY: PageTrashState = {
  documentId: null,
  pages: [],
  loaded: false,
  failed: false,
  open: false,
  focus: null,
};

/** How many pages the Trash holds: each row's page and its subpages. */
export function trashedCount(pages: readonly TrashedPage[]): number {
  let n = 0;
  for (const page of pages) n += 1 + page.subpages.length;
  return n;
}

/** Every page id in the Trash, a subpage's too: what a link to one of them reads as. */
export function trashedIds(pages: readonly TrashedPage[]): string[] {
  const ids: string[] = [];
  for (const page of pages) {
    ids.push(page.id);
    for (const sub of page.subpages) ids.push(sub.id);
  }
  return ids;
}

export function createPageTrashStore() {
  let state: PageTrashState = EMPTY;
  let session: TrashSession | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reading = 0;
  const listeners = new Set<() => void>();
  const set = (next: Partial<PageTrashState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  const sameSession = (s: TrashSession) =>
    session?.documentId === s.documentId &&
    session.who.ownerId === s.who.ownerId &&
    session.who.shareCode === s.who.shareCode;

  async function refresh(): Promise<void> {
    const s = session;
    if (!s) return;
    const mine = ++reading;
    try {
      const pages = await apiPageTrash(s.who, s.documentId);
      // A later read, or another knowledgebase, has taken over.
      if (mine !== reading || session !== s) return;
      set({ pages, loaded: true, failed: false });
    } catch {
      if (mine !== reading || session !== s) return;
      set({ failed: !state.loaded });
    }
  }

  // Drops the page from what is shown at once, so a press is answered before the request is.
  const without = (id: string) => state.pages.filter((p) => p.id !== id);

  return {
    get: (): PageTrashState => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Read the Trash for this session, or forget it (null: the session may not see it). */
    attach(next: TrashSession | null): void {
      if (next && sameSession(next)) return;
      clearTimeout(timer);
      session = next;
      reading++;
      state = { ...EMPTY, documentId: next?.documentId ?? null };
      listeners.forEach((listener) => listener());
      if (next) void refresh();
    },
    refresh,
    /** Read again soon: the page list changed, so a page may have gone to the Trash or come back. */
    scheduleRefresh(delay = TRASH_REFRESH_MS): void {
      if (!session) return;
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), delay);
    },
    open(focus: string | null = null): void {
      if (!session) return;
      set({ open: true, focus });
      void refresh();
    },
    close(): void {
      set({ open: false, focus: null });
    },
    /** Whether the Trash holds this page, as last read. */
    holds(id: string): boolean {
      return state.pages.some((p) => p.id === id || p.subpages.some((s) => s.id === id));
    },
    async restore(id: string): Promise<PageRestoreResponse | null> {
      const s = session;
      if (!s) return null;
      const before = state.pages;
      set({ pages: without(id) });
      try {
        const answer = await apiRestorePage(s.who, s.documentId, id);
        void refresh();
        return answer;
      } catch (error) {
        if (session === s) set({ pages: before });
        throw error;
      }
    },
    async deleteForever(id: string): Promise<void> {
      const s = session;
      if (!s) return;
      const before = state.pages;
      set({ pages: without(id) });
      try {
        await apiDeletePageForever(s.who, s.documentId, id);
      } catch (error) {
        if (session === s) set({ pages: before });
        throw error;
      }
    },
    async empty(): Promise<void> {
      const s = session;
      if (!s) return;
      const before = state.pages;
      set({ pages: [] });
      try {
        await apiEmptyPageTrash(s.who, s.documentId);
      } catch (error) {
        if (session === s) set({ pages: before });
        throw error;
      }
    },
  };
}

export type PageTrashStore = ReturnType<typeof createPageTrashStore>;

/** The editor's one Trash store. */
export const pageTrashStore = createPageTrashStore();

/** Open the Trash dialog, marking `focus` when given. */
export const openPageTrash = (focus: string | null = null): void => pageTrashStore.open(focus);

export function usePageTrashState(store: PageTrashStore = pageTrashStore): PageTrashState {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
