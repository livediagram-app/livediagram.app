'use client';

// What a knowledgebase page shows in its writing beside its words: its icon over the title (page-surface.md "The page
// icon"), the meta row under it, and at its foot an empty page's drawing (EmptyPage), Linked From and the page's comment threads (page-comments.md). Drawn through portals into the hosts the writing keeps for them
// (lib/knowledge/page-slots-plugin.ts). A page drawn outside the editor (a test, a preview) has no store, and so
// shows neither.
import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { EditorChromeContext, useEditorChrome } from '@/app/document/[id]/EditorContext';
import type { PageSlots } from '@/lib/knowledge/page-slots-plugin';
import { EmptyPage, isEmptyPage } from './EmptyPage';
import { LinkedFrom } from './LinkedFrom';
import { PageMetaRow } from './PageMetaRow';
import { PageComments } from '@/components/page-comments/PageComments';
import { PageIconHead } from '@/components/page-icon/PageIconHead';

export function PageKnowledgeSlots({ slots }: { slots: PageSlots }) {
  const store = useContext(EditorChromeContext);
  if (!store) return null;
  return (
    <>
      {createPortal(<PageIconHead />, slots.head)}
      {createPortal(<PageMetaRow />, slots.meta)}
      {createPortal(
        <>
          <EmptyPage />
          <LinkedFrom />
          <CommentsOnceWritten />
        </>,
        slots.foot,
      )}
    </>
  );
}

// An empty page has no Comments, threads or not (page-comments.md "An empty page has no Comments"): they appear once
// the page has some writing, live as it is typed.
function CommentsOnceWritten() {
  const empty = useEditorChrome((s) => isEmptyPage(s.pageTab.articles));
  return empty ? null : <PageComments />;
}
