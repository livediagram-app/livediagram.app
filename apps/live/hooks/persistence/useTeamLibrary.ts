'use client';

import { truncateName } from '@livediagram/document';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentSummary, Folder } from '@livediagram/api-schema';
import {
  apiCreateFolder,
  apiDeleteDocument,
  apiDeleteFolder,
  apiGetTeamLibrary,
  apiSaveDocumentMeta,
  apiSetDocumentFolder,
  apiUpdateFolder,
} from '@/lib/api-client';
import { duplicateDocument as duplicateDocumentApi } from '@/lib/duplicate-document';
import { accepted } from '@/lib/accepted';
import { track } from '@/lib/telemetry';
import { indexFolders, folderBreadcrumb, groupDocumentsByFolder } from '@/lib/folder-tree';

// One team's shared library (docs/specs/013-workspace/team-shared-documents.md): the folder tree + documents the
// "Shared documents" section on the team page renders, plus the
// mutations every joined member may perform. Mirrors useFolders +
// useExplorerState's derived shapes, scoped to a single team. All
// mutations refetch — the library is shared, so optimistic local
// state would drift the moment a teammate touches it anyway.

export function useTeamLibrary(ownerId: string | null, teamId: string) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [liveDocs, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Sets state only from the response callbacks, so the load effect below
  // only starts the request.
  const refresh = useCallback(async () => {
    if (!ownerId) return;
    await apiGetTeamLibrary(ownerId, teamId)
      .then(
        (lib) => {
          setFolders(lib.folders);
          setDocuments(lib.documents);
        },
        () => {
          // Transient failure: keep whatever is on screen, next refresh
          // reconciles (same posture as useFolders).
        },
      )
      .finally(() => setLoading(false));
  }, [ownerId, teamId]);

  // Another team (or owner) starts from an empty, loading library, cleared
  // during render so the previous team's tree never shows under this one.
  const libraryKey = `${ownerId}\0${teamId}`;
  const [loadedKey, setLoadedKey] = useState(libraryKey);
  if (libraryKey !== loadedKey) {
    setLoadedKey(libraryKey);
    setFolders([]);
    setDocuments([]);
    setLoading(true);
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { folderById, childrenByParent, rootFolders } = useMemo(() => {
    return indexFolders(folders);
  }, [folders]);

  const documentsByFolder = useMemo(() => groupDocumentsByFolder(liveDocs), [liveDocs]);

  // Breadcrumb chain root → folderId, tolerant of dangling parents
  // mid-refresh (same shape as the personal explorer's).
  const breadcrumb = useCallback(
    (folderId: string | null): Folder[] => {
      return folderBreadcrumb(folderById, folderId);
    },
    [folderById],
  );

  const createFolder = useCallback(
    // `name` defaults to the rename-me stub the tree flow uses; the move
    // picker's New Folder tile passes a real name up front.
    async (parentId: string | null, name?: string): Promise<Folder | undefined> => {
      if (!ownerId) return undefined;
      try {
        const folder = await apiCreateFolder(ownerId, {
          id: crypto.randomUUID(),
          name: name?.trim() || 'New folder',
          parentId,
          teamId,
        });
        track('Folder', 'Created', 'Team');
        await refresh();
        return folder;
      } catch {
        return undefined;
      }
    },
    [ownerId, teamId, refresh],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      if (!ownerId || !name.trim()) return;
      if (await accepted(apiUpdateFolder(ownerId, id, { name: name.trim() })))
        track('Folder', 'Renamed', 'Team');
      await refresh();
    },
    [ownerId, refresh],
  );

  const moveFolder = useCallback(
    async (id: string, parentId: string | null) => {
      if (!ownerId) return;
      if (await accepted(apiUpdateFolder(ownerId, id, { parentId })))
        track('Folder', 'Moved', 'Team');
      await refresh();
    },
    [ownerId, refresh],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      if (!ownerId) return;
      if (await accepted(apiDeleteFolder(ownerId, id))) track('Folder', 'Deleted', 'Team');
      await refresh();
    },
    [ownerId, refresh],
  );

  // Re-folder a document WITHIN the team (folderId null = the team's
  // Unsorted).
  const moveDocument = useCallback(
    async (documentId: string, folderId: string | null) => {
      if (!ownerId) return;
      if (await accepted(apiSetDocumentFolder(ownerId, documentId, folderId, teamId)))
        track('Team', 'Moved', 'Document');
      await refresh();
    },
    [ownerId, teamId, refresh],
  );

  // Hard-delete a team document. Any joined member may delete it
  // (docs/specs/013-workspace/team-shared-documents.md), gated server-side by the team-member delete check.
  const deleteDocument = useCallback(
    async (documentId: string) => {
      if (!ownerId) return;
      if (await accepted(apiDeleteDocument(ownerId, documentId))) track('Document', 'Deleted');
      await refresh();
    },
    [ownerId, refresh],
  );

  // Rename a team document in place. Any joined member may edit it
  // (docs/specs/013-workspace/team-shared-documents.md), gated server-side by canEditDocument.
  const renameDocument = useCallback(
    async (documentId: string, name: string) => {
      if (!ownerId) return;
      // docs/specs/006-document/name-length.md.
      const trimmed = truncateName(name);
      if (!trimmed) return;
      if (await accepted(apiSaveDocumentMeta(ownerId, { id: documentId, name: trimmed })))
        track('Document', 'Renamed');
      await refresh();
    },
    [ownerId, refresh],
  );

  // Duplicate a team document, keeping the copy IN the team alongside
  // the original (same folder), filed by the create itself
  // (docs/specs/013-workspace/team-shared-documents.md).
  const duplicateDocument = useCallback(
    async (documentId: string) => {
      if (!ownerId) return;
      const sourceFolderId = liveDocs.find((d) => d.id === documentId)?.folderId ?? null;
      const newId = await duplicateDocumentApi(ownerId, documentId, {
        teamId,
        folderId: sourceFolderId,
      });
      if (!newId) return;
      track('Document', 'Duplicated');
      await refresh();
    },
    [ownerId, teamId, liveDocs, refresh],
  );

  return {
    folders,
    documents: liveDocs,
    loading,
    refresh,
    folderById,
    childrenByParent,
    rootFolders,
    documentsByFolder,
    breadcrumb,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    moveDocument,
    deleteDocument,
    renameDocument,
    duplicateDocument,
  };
}
