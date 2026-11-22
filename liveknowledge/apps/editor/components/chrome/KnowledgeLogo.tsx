'use client';

// The liveknowledge logo at the head of the editor's chrome (docs/specs/030-knowledgebase/page-surface.md "The
// logo"): heading the page tree, leading the top row when the tree is folded away, and leading the Ask and AI
// Knowledge views' header. It opens the Explorer on the place that holds the open knowledgebase. The wordmark shows
// on a desktop; a phone has the mark alone.
import { Brand } from '@liveknowledge/ui';
import { useContext, useSyncExternalStore } from 'react';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';

const noSubscribe = () => () => {};

/** The open knowledgebase's id, read without requiring the editor's store (a test or a workbench has none). */
function useOpenItemId(): string | null {
  const store = useContext(EditorChromeContext);
  return useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().documentId ?? null,
    () => null,
  );
}

export function KnowledgeLogo({
  wordmarkClassName = 'phone:hidden',
  className = '',
}: {
  wordmarkClassName?: string;
  className?: string;
}) {
  const itemId = useOpenItemId();
  return (
    <Brand
      href={explorerItemHref(itemId)}
      size="sm"
      wordmarkClassName={wordmarkClassName}
      className={`relative touch-target ${className}`}
    />
  );
}
