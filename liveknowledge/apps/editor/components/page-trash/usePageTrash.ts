'use client';

// Who sees the knowledgebase's page Trash in this session, and keeping the store in step with the knowledgebase
// (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page Trash"). A writer of the whole knowledgebase
// (an Editor or a Participant) sees it, outside an embed, a workbench pane, a Community visit and an Offline
// knowledgebase; an Editor alone deletes forever and empties it. Read from the chrome store a slice at a time, so a
// typing commit renders none of it.
import { useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { pageTrashStore, type TrashSession } from '@/lib/knowledge/page-trash-store';
import type { EditorContextValue as EditorChromeValue } from '@/app/document/[id]/EditorContext';

export type PageTrashRights = { see: boolean; deleteForever: boolean };

const NO_RIGHTS: PageTrashRights = { see: false, deleteForever: false };
const noSubscribe = () => () => {};

/** What a session may do with the Trash, from the editor's state; Offline is decided by the caller. */
export function pageTrashRightsOf(s: EditorChromeValue, offline: boolean): PageTrashRights {
  const see =
    !offline &&
    !!s.documentId &&
    s.hydrated &&
    s.can.editPages &&
    !s.isStructureReadOnly &&
    !s.sessionTabScope &&
    !s.embedMode &&
    !s.workbench &&
    !s.sessionCommunity;
  return see ? { see, deleteForever: s.can.manageKnowledgebase } : NO_RIGHTS;
}

const rightsKey = (r: PageTrashRights) => (r.see ? (r.deleteForever ? 2 : 1) : 0);

/** The session's rights, and the session the store reads for (null when it may not see the Trash). */
export function usePageTrashSession(): { rights: PageTrashRights; session: TrashSession | null } {
  // Drawn on its own (a test, a preview) the chrome has no editor store, and so no Trash.
  const store = useContext(EditorChromeContext);
  const documentId = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().documentId ?? null,
    () => null,
  );
  const offline = useIsOfflineDocument(documentId);
  const key = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => (store ? rightsKey(pageTrashRightsOf(store.get(), offline)) : 0),
    () => 0,
  );
  const ownerId = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().selfParticipant.id ?? '',
    () => '',
  );
  const shareCode = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().sessionShareCode ?? null,
    () => null,
  );
  return useMemo(() => {
    const rights: PageTrashRights = key === 0 ? NO_RIGHTS : { see: true, deleteForever: key === 2 };
    const session = rights.see && documentId ? { documentId, who: { ownerId, shareCode } } : null;
    return { rights, session };
  }, [key, documentId, ownerId, shareCode]);
}

/** Keeps the one Trash store reading this knowledgebase's Trash: on the session, and soon after each change of the
 *  page count (a delete's DELETEs, an Undo, a peer's change). Mounted once, by the page tree's host. */
export function usePageTrashSync(): PageTrashRights {
  const { rights, session } = usePageTrashSession();
  const store = useContext(EditorChromeContext);
  const pageCount = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().tabs.length ?? 0,
    () => 0,
  );
  useEffect(() => {
    pageTrashStore.attach(session);
  }, [session]);
  useEffect(() => () => pageTrashStore.attach(null), []);
  // The first count is read by attach itself: only a change reads again.
  const seen = useRef(pageCount);
  useEffect(() => {
    if (seen.current === pageCount) return;
    seen.current = pageCount;
    pageTrashStore.scheduleRefresh();
  }, [pageCount]);
  return rights;
}
