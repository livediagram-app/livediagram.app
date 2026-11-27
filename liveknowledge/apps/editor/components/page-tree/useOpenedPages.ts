'use client';

// What this reader has opened in the page tree, per knowledgebase, in this browser
// (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree"). Every page starts closed but the first,
// so a knowledgebase loads with its top-level pages and the first one's subpages showing (Work Tracker 1486, 1489); a
// page the reader opens stays open across reloads, and the first page the reader closes stays closed. Read again when another knowledgebase opens, and when a page made or moved under a closed one opens
// its parents from outside the tree (openParentsOf).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  openedWithFirst,
  readOpenedPages,
  subscribeOpenedPages,
  withPageOpen,
  withParentsOpened,
  writeOpenedPages,
} from '@/lib/page-tree-open';

/** `first` is the knowledgebase's first top-level page, open until the reader closes it; null for none. */
export function useOpenedPages(
  documentId: string | null,
  first: string | null = null,
): {
  opened: ReadonlySet<string>;
  onSetOpen: (id: string, open: boolean) => void;
} {
  const [openedFor, setOpenedFor] = useState(() => ({
    documentId,
    opened: readOpenedPages(documentId),
  }));
  if (openedFor.documentId !== documentId) {
    setOpenedFor({ documentId, opened: readOpenedPages(documentId) });
  }
  useEffect(
    () =>
      subscribeOpenedPages((changed, pages, ids) =>
        setOpenedFor((state) => {
          if (state.documentId !== changed) return state;
          const opened = withParentsOpened(state.opened, pages, ids);
          return opened === state.opened ? state : { ...state, opened };
        }),
      ),
    [documentId],
  );
  const onSetOpen = useCallback(
    (id: string, open: boolean) =>
      setOpenedFor((state) => {
        if (openedWithFirst(state.opened, first).has(id) === open) return state;
        const opened = withPageOpen(state.opened, id, open, first);
        writeOpenedPages(state.documentId, opened);
        return { ...state, opened };
      }),
    [first],
  );
  // What shows open: what is stored, with the first page unless the reader closed it. One set a change of either.
  const opened = useMemo(() => openedWithFirst(openedFor.opened, first), [openedFor.opened, first]);
  return { opened, onSetOpen };
}
