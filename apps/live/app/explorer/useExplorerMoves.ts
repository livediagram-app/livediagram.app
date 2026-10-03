'use client';

import { useMemo, useRef, useState } from 'react';
import {
  apiCreateFolder,
  apiSetDocumentFolder,
  apiUpdateFolder,
  type DocumentListItem,
  type Folder,
  type TeamListItem,
} from '@/lib/api-client';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { track } from '@/lib/telemetry';
import type { TeamDocumentRow, TeamFolderRow } from '@/hooks/persistence/useTeamLibrariesSweep';

// The unified move-picker slice (docs/specs/013-workspace/team-shared-documents.md), lifted out of
// useExplorerState: the picker's open-target state, the per-placement
// move handlers (personal folder / into a team / within a team / out
// of a team), the one routing entry point the picker calls, and the
// destination-tree derivations it renders. The host keeps ownership
// of the lists themselves and passes the mutators in.
export function useExplorerMoves({
  ownerId,
  documents: liveDocs,
  setDocuments,
  folders,
  teams,
  teamFolders,
  teamDocuments,
  descendantSet,
  refreshFolders,
  refreshTeamLibraries,
  refreshPersonal,
  moveDocumentToFolder,
  toast,
}: {
  ownerId: string | null;
  documents: DocumentListItem[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentListItem[]>>;
  folders: Folder[];
  teams: TeamListItem[];
  teamFolders: TeamFolderRow[];
  teamDocuments: TeamDocumentRow[];
  descendantSet: (rootId: string) => Set<string>;
  refreshFolders: () => Promise<void>;
  refreshTeamLibraries: () => void;
  refreshPersonal: (ownerId: string) => Promise<void>;
  moveDocumentToFolder: (id: string, folderId: string | null) => void;
  toast: { error: (message: string) => void };
}) {
  // Move picker target. The picker uses moveAnchorRef for placement.
  // `kind` discriminates whether we're moving a document or a folder
  // so the picker can filter (a folder can't be moved into itself
  // or its descendants — the server cycle-checks but the picker
  // hides those rows up-front to make the rejection less surprising).
  // One modal serves every document, personal or team (docs/specs/013-workspace/team-shared-documents.md): it
  // shows the full destination tree and `moveDocumentTo` routes the
  // pick from the subject's current placement.
  const [moveTarget, setMoveTarget] = useState<
    { kind: 'document'; id: string } | { kind: 'folder'; id: string } | null
  >(null);
  const moveAnchorRef = useRef<HTMLElement | null>(null);

  // Move a folder under a new parent. Used by the picker. The hook
  // doesn't expose a reparent helper directly because folder moves
  // are rare; we shape the optimistic update locally and fire the
  // API call ourselves.
  const moveFolderToParent = (id: string, parentId: string | null) => {
    if (!ownerId) return;
    // No-op if we'd be moving into ourselves or a descendant — the
    // picker already filters these, this is belt-and-braces.
    if (parentId && descendantSet(id).has(parentId)) return;
    // Folder moves are rare enough that one refresh round-trip is fine
    // (useFolders owns the canonical list) — but it must run AFTER the
    // update commits, or the GET can be served first and re-render the
    // folder under its old parent with nothing left to reconcile it.
    void apiUpdateFolder(ownerId, id, { parentId })
      .then(() => {
        refreshFolders();
        track('Folder', 'Moved');
      })
      .catch(() => {});
  };

  // Send one of the caller's own documents into a team's shared
  // library (docs/specs/013-workspace/team-shared-documents.md) — straight into a team folder when the move
  // picker chose one, else the team's root. Leaves the personal
  // lists either way, so the local row is dropped optimistically.
  const moveDocumentToTeam = (id: string, teamId: string, folderId: string | null = null) => {
    if (!ownerId) return;
    const row = liveDocs.find((d) => d.id === id) ?? null;
    // Re-sweep on success so the document appears under the team in
    // Recent / the sidebar / the move picker (the sibling team moves do
    // the same; omitting it left the row invisible until a later bump).
    // On failure, roll the optimistic removal back and say so — the
    // silent path left the document in neither list, looking deleted
    // (mirrors moveDocumentToFolder's rollback).
    void apiSetDocumentFolder(ownerId, id, folderId, teamId)
      .then(() => {
        refreshTeamLibraries();
        track('Team', 'Added', 'Document');
      })
      .catch(() => {
        if (row) setDocuments((prev) => (prev.some((d) => d.id === id) ? prev : [row, ...prev]));
        toast.error('Could not move the document to the team. Please try again.');
      });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Re-folder a team-library document WITHIN its team (folderId null =
  // the team's root), then re-sweep so Recent's rows repaint.
  // Same call the team page's own move uses (docs/specs/013-workspace/team-shared-documents.md).
  const moveTeamDocumentToFolder = (id: string, teamId: string, folderId: string | null) => {
    if (!ownerId) return;
    // .then BEFORE .catch, deliberately: chained the other way round the
    // success handler also runs after a swallowed rejection, which is harmless
    // for a refresh but would keep counting moves that never happened.
    void apiSetDocumentFolder(ownerId, id, folderId, teamId)
      .then(() => {
        refreshTeamLibraries();
        track('Team', 'Moved', 'Document');
      })
      .catch(() => {});
  };

  // Move a team-library document OUT of its team — either to the
  // caller's personal library (toTeamId null; the server transfers
  // ownership to the mover, docs/specs/013-workspace/team-shared-documents.md) or on to another team
  // (toTeamId set). Refreshes both the team sweep (the row leaves /
  // moves) and the personal list (it lands there when going personal).
  const moveTeamDocumentOut = (id: string, toTeamId: string | null, folderId: string | null) => {
    if (!ownerId) return;
    void apiSetDocumentFolder(ownerId, id, folderId, toTeamId)
      .then(() => {
        refreshTeamLibraries();
        void refreshPersonal(ownerId);
        track('Team', toTeamId === null ? 'Removed' : 'Moved', 'Document');
      })
      .catch(() => {});
  };

  // One entry point for the unified move picker (docs/specs/013-workspace/team-shared-documents.md): route a
  // pick to the right handler from the subject's CURRENT placement
  // (personal vs which team) and its destination.
  const moveDocumentTo = (id: string, dest: { teamId: string | null; folderId: string | null }) => {
    const fromTeamId = teamDocuments.find((d) => d.id === id)?.team.id ?? null;
    if (fromTeamId === null) {
      // Currently personal: file into a folder, or hand off to a team.
      if (dest.teamId === null) moveDocumentToFolder(id, dest.folderId);
      else moveDocumentToTeam(id, dest.teamId, dest.folderId);
      return;
    }
    // Currently in a team: re-folder within it, or move it out
    // (to personal, or on to another team).
    if (dest.teamId === fromTeamId) moveTeamDocumentToFolder(id, fromTeamId, dest.folderId);
    else moveTeamDocumentOut(id, dest.teamId, dest.folderId);
  };

  const openMovePickerForDocument = (id: string, anchor: HTMLElement | null) => {
    moveAnchorRef.current = anchor;
    setMoveTarget({ kind: 'document', id });
  };

  const openMovePickerForFolder = (id: string, anchor: HTMLElement | null) => {
    moveAnchorRef.current = anchor;
    setMoveTarget({ kind: 'folder', id });
  };

  // Personal folder nodes for the move picker (it rebuilds the tree
  // from parentId). For a folder move we hide the target's own subtree
  // so cycle-creating choices don't appear.
  const movePersonalFolders = useMemo(() => {
    const excluded =
      moveTarget?.kind === 'folder' ? descendantSet(moveTarget.id) : new Set<string>();
    return folders
      .filter((f) => !excluded.has(f.id))
      .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }));
  }, [folders, moveTarget, descendantSet]);

  // Team destinations for the move picker (document moves only): each
  // team with its folder tree, so a document can land in a team folder
  // in one move. Folders carry parentId for the indented tree. An
  // offline document (docs/specs/006-document/offline-mode.md) gets none — a team's shared library is
  // server-side, so a team move could never land.
  const moveTeamDests = useMemo(() => {
    if (
      moveTarget?.kind === 'document' &&
      liveDocs.find((d) => d.id === moveTarget.id)?.ownerId === OFFLINE_OWNER_ID
    ) {
      return [];
    }
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      folders: teamFolders
        .filter((f) => f.teamId === t.id)
        .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
    }));
  }, [teams, teamFolders, moveTarget, liveDocs]);

  // Inline folder creation from the move picker's "New Folder" tile:
  // create in the picked scope (personal, or a team's library), refresh
  // the matching list so the new tile appears, and hand the folder back
  // so the browser can select it as the destination.
  const createMoveFolder = async (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ): Promise<{ id: string; name: string; parentId: string | null } | null> => {
    if (!ownerId) return null;
    try {
      const folder = await apiCreateFolder(ownerId, {
        id: crypto.randomUUID(),
        name,
        parentId,
        teamId,
      });
      if (teamId) refreshTeamLibraries();
      else await refreshFolders();
      track('Folder', 'Created', teamId ? 'Team' : undefined);
      return { id: folder.id, name: folder.name, parentId: folder.parentId };
    } catch {
      return null;
    }
  };

  return {
    moveTarget,
    setMoveTarget,
    moveAnchorRef,
    moveFolderToParent,
    createMoveFolder,
    moveDocumentToTeam,
    moveTeamDocumentToFolder,
    moveTeamDocumentOut,
    moveDocumentTo,
    openMovePickerForDocument,
    openMovePickerForFolder,
    movePersonalFolders,
    moveTeamDests,
  };
}
