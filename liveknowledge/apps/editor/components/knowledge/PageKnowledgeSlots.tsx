'use client';

// What a knowledgebase page shows in its writing beside its words: the meta row under the title, and Linked From
// at its foot. Drawn through portals into the hosts the writing keeps for them
// (lib/knowledge/page-slots-plugin.ts). A page drawn outside the editor (a test, a preview) has no store, and so
// shows neither.
import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import type { PageSlots } from '@/lib/knowledge/page-slots-plugin';
import { LinkedFrom } from './LinkedFrom';
import { PageMetaRow } from './PageMetaRow';

export function PageKnowledgeSlots({ slots }: { slots: PageSlots }) {
  const store = useContext(EditorChromeContext);
  if (!store) return null;
  return (
    <>
      {createPortal(<PageMetaRow />, slots.meta)}
      {createPortal(<LinkedFrom />, slots.foot)}
    </>
  );
}
