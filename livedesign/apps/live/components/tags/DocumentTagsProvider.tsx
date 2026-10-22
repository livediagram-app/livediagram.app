'use client';

// The reader's tags for every surface under it (docs/specs/013-workspace/tags.md): the Explorer page mounts it eager,
// the editor lazy (it loads the first time something reads it). It also hosts the one tag picker, so a document menu
// can close and hand the picker its anchor: the menu is gone by the time the picker opens.

import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Tag } from '@livedesign/api-schema';
import { useDocumentTagsState, type DocumentTagsState } from './useDocumentTagsState';

// The picker loads on first open, so no surface pays for it up front.
const TagPicker = dynamic(() => import('./TagPicker').then((m) => m.TagPicker), { ssr: false });

export type TagPickerTarget = { documentId: string; documentName: string; anchor: HTMLElement };

type DocumentTagsValue = DocumentTagsState & {
  // A provider with an owner is mounted: the surfaces that offer tags show them.
  available: boolean;
  openPicker: (target: TagPickerTarget) => void;
};

const NO_TAGS: readonly Tag[] = [];
const NOTHING: ReadonlySet<string> = new Set();

const INERT: DocumentTagsValue = {
  available: false,
  status: 'idle',
  tags: NO_TAGS as Tag[],
  tagById: new Map(),
  tagsFor: () => NO_TAGS as Tag[],
  documentsFor: () => NOTHING,
  request: () => {},
  reload: async () => {},
  createTag: () => null,
  updateTag: () => {},
  deleteTag: () => {},
  setDocumentTag: () => {},
  openPicker: () => {},
};

const DocumentTagsContext = createContext<DocumentTagsValue>(INERT);

/** The reader's tags, loading them on first use under a lazy provider; inert where none is mounted. */
export function useDocumentTags(): DocumentTagsValue {
  const value = useContext(DocumentTagsContext);
  const { request } = value;
  useEffect(() => request(), [request]);
  return value;
}

export function DocumentTagsProvider({
  ownerId,
  lazy = false,
  children,
}: {
  ownerId: string | null;
  // Load on first use rather than on mount (the editor).
  lazy?: boolean;
  children: ReactNode;
}) {
  const state = useDocumentTagsState(ownerId, !lazy);
  const [picker, setPicker] = useState<TagPickerTarget | null>(null);
  const openPicker = useCallback((target: TagPickerTarget) => setPicker(target), []);
  const value = useMemo<DocumentTagsValue>(
    () => ({ ...state, available: ownerId !== null, openPicker }),
    [state, ownerId, openPicker],
  );
  return (
    <DocumentTagsContext.Provider value={value}>
      {children}
      {picker ? (
        <TagPicker key={picker.documentId} target={picker} onClose={() => setPicker(null)} />
      ) : null}
    </DocumentTagsContext.Provider>
  );
}
