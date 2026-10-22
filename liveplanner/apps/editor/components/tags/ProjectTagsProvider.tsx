'use client';

// The reader's tags for every surface under it (docs/specs/013-workspace/tags.md): the Explorer page mounts it eager,
// the editor lazy (it loads the first time something reads it). It also hosts the one tag picker, so a project menu
// can close and hand the picker its anchor: the menu is gone by the time the picker opens.

import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Tag } from '@liveplanner/api-schema';
import { useProjectTagsState, type ProjectTagsState } from './useProjectTagsState';

// The picker loads on first open, so no surface pays for it up front.
const TagPicker = dynamic(() => import('./TagPicker').then((m) => m.TagPicker), { ssr: false });

export type TagPickerTarget = { projectId: string; projectName: string; anchor: HTMLElement };

type ProjectTagsValue = ProjectTagsState & {
  // A provider with an owner is mounted: the surfaces that offer tags show them.
  available: boolean;
  openPicker: (target: TagPickerTarget) => void;
};

const NO_TAGS: readonly Tag[] = [];
const NOTHING: ReadonlySet<string> = new Set();

const INERT: ProjectTagsValue = {
  available: false,
  status: 'idle',
  tags: NO_TAGS as Tag[],
  tagById: new Map(),
  tagsFor: () => NO_TAGS as Tag[],
  projectsFor: () => NOTHING,
  request: () => {},
  reload: async () => {},
  createTag: () => null,
  updateTag: () => {},
  deleteTag: () => {},
  setProjectTag: () => {},
  openPicker: () => {},
};

const ProjectTagsContext = createContext<ProjectTagsValue>(INERT);

/** The reader's tags, loading them on first use under a lazy provider; inert where none is mounted. */
export function useProjectTags(): ProjectTagsValue {
  const value = useContext(ProjectTagsContext);
  const { request } = value;
  useEffect(() => request(), [request]);
  return value;
}

export function ProjectTagsProvider({
  ownerId,
  lazy = false,
  children,
}: {
  ownerId: string | null;
  // Load on first use rather than on mount (the editor).
  lazy?: boolean;
  children: ReactNode;
}) {
  const state = useProjectTagsState(ownerId, !lazy);
  const [picker, setPicker] = useState<TagPickerTarget | null>(null);
  const openPicker = useCallback((target: TagPickerTarget) => setPicker(target), []);
  const value = useMemo<ProjectTagsValue>(
    () => ({ ...state, available: ownerId !== null, openPicker }),
    [state, ownerId, openPicker],
  );
  return (
    <ProjectTagsContext.Provider value={value}>
      {children}
      {picker ? (
        <TagPicker key={picker.projectId} target={picker} onClose={() => setPicker(null)} />
      ) : null}
    </ProjectTagsContext.Provider>
  );
}
