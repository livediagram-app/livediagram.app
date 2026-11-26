'use client';

// What this reader has opened in the page tree, per knowledgebase, in this browser
// (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree"). Every page starts closed, so a
// knowledgebase loads with only its top-level pages showing (Work Tracker 1486); a page the reader opens stays open
// across reloads. Read again when another knowledgebase opens, and when a page made or moved under a closed one opens
// its parents from outside the tree (openParentsOf).
import { useCallback, useEffect, useState } from 'react';
import {
  readOpenedPages,
  subscribeOpenedPages,
  withParentsOpened,
  writeOpenedPages,
} from '@/lib/page-tree-open';

export function useOpenedPages(documentId: string | null): {
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
        if (state.opened.has(id) === open) return state;
        const opened = new Set(state.opened);
        if (open) opened.add(id);
        else opened.delete(id);
        writeOpenedPages(state.documentId, opened);
        return { ...state, opened };
      }),
    [],
  );
  return { opened: openedFor.opened, onSetOpen };
}
