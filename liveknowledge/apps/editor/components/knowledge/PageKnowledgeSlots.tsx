'use client';

// What a knowledgebase page shows in its writing beside its words: the meta row under the title, and at its foot
// an empty page's drawing (EmptyPage), Linked From and the page's comment threads (page-comments.md). Drawn through portals into the hosts the writing keeps for them
// (lib/knowledge/page-slots-plugin.ts). A page drawn outside the editor (a test, a preview) has no store, and so
// shows neither.
import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import type { PageSlots } from '@/lib/knowledge/page-slots-plugin';
import { EmptyPage } from './EmptyPage';
import { LinkedFrom } from './LinkedFrom';
import { PageMetaRow } from './PageMetaRow';
import { PageComments } from '@/components/page-comments/PageComments';

export function PageKnowledgeSlots({ slots }: { slots: PageSlots }) {
  const store = useContext(EditorChromeContext);
  if (!store) return null;
  return (
    <>
      {createPortal(<PageMetaRow />, slots.meta)}
      {createPortal(
        <>
          <EmptyPage />
          <LinkedFrom />
          <PageComments />
        </>,
        slots.foot,
      )}
    </>
  );
}
