'use client';

import { useMemo, useRef, useState } from 'react';
import {
  apiSetDiagramFolder,
  apiUpdateFolder,
  type DiagramListItem,
  type Folder,
  type TeamListItem,
} from '@/lib/api-client';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { track } from '@/lib/telemetry';
import type { TeamDiagramRow, TeamFolderRow } from '@/hooks/persistence/useTeamLibrariesSweep';

// The unified move-picker slice (spec/35), lifted out of
// useExplorerState: the picker's open-target state, the per-placement
// move handlers (personal folder / into a team / within a team / out
// of a team), the one routing entry point the picker calls, and the
// destination-tree derivations it renders. The host keeps ownership
// of the lists themselves and passes the mutators in.
export function useExplorerMoves({
  ownerId,
  diagrams,
  setDiagrams,
  folders,
  teams,
  teamFolders,
  teamDiagrams,
  descendantSet,
  refreshFolders,
  refreshTeamLibraries,
  refreshPersonal,
  moveDiagramToFolder,
  toast,
}: {
  ownerId: string | null;
  diagrams: DiagramListItem[];
  setDiagrams: React.Dispatch<React.SetStateAction<DiagramListItem[]>>;
  folders: Folder[];
  teams: TeamListItem[];
  teamFolders: TeamFolderRow[];
  teamDiagrams: TeamDiagramRow[];
  descendantSet: (rootId: string) => Set<string>;
  refreshFolders: () => Promise<void>;
  refreshTeamLibraries: () => void;
  refreshPersonal: (ownerId: string) => Promise<void>;
  moveDiagramToFolder: (id: string, folderId: string | null) => void;
  toast: { error: (message: string) => void };
}) {
  // Move picker target. The picker uses moveAnchorRef for placement.
  // `kind` discriminates whether we're moving a diagram or a folder
  // so the picker can filter (a folder can't be moved into itself
  // or its descendants — the server cycle-checks but the picker
  // hides those rows up-front to make the rejection less surprising).
  // One modal serves every diagram, personal or team (spec/35): it
  // shows the full destination tree and `moveDiagramTo` routes the
  // pick from the subject's current placement.
  const [moveTarget, setMoveTarget] = useState<
    { kind: 'diagram'; id: string } | { kind: 'folder'; id: string } | null
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
      .then(() => refreshFolders())
      .catch(() => {});
    track('Folder', 'Moved');
  };

  // Send one of the caller's own diagrams into a team's shared
  // library (spec/35) — straight into a team folder when the move
  // picker chose one, else the team's Unsorted. Leaves the personal
  // lists either way, so the local row is dropped optimistically.
  const moveDiagramToTeam = (id: string, teamId: string, folderId: string | null = null) => {
    if (!ownerId) return;
    const row = diagrams.find((d) => d.id === id) ?? null;
    // Re-sweep on success so the diagram appears under the team in
    // Recent / the sidebar / the move picker (the sibling team moves do
    // the same; omitting it left the row invisible until a later bump).
    // On failure, roll the optimistic removal back and say so — the
    // silent path left the diagram in neither list, looking deleted
    // (mirrors moveDiagramToFolder's rollback).
    void apiSetDiagramFolder(ownerId, id, folderId, teamId)
      .then(() => refreshTeamLibraries())
      .catch(() => {
        if (row) setDiagrams((prev) => (prev.some((d) => d.id === id) ? prev : [row, ...prev]));
        toast.error('Could not move the diagram to the team. Please try again.');
      });
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    track('Team', 'Added', 'Diagram');
  };

  // Re-folder a team-library diagram WITHIN its team (folderId null =
  // the team's Unsorted), then re-sweep so Recent's rows repaint.
  // Same call the team page's own move uses (spec/35).
  const moveTeamDiagramToFolder = (id: string, teamId: string, folderId: string | null) => {
    if (!ownerId) return;
    void apiSetDiagramFolder(ownerId, id, folderId, teamId)
      .catch(() => {})
      .then(() => refreshTeamLibraries());
    track('Team', 'Moved', 'Diagram');
  };

  // Move a team-library diagram OUT of its team — either to the
  // caller's personal library (toTeamId null; the server transfers
  // ownership to the mover, spec/35) or on to another team
  // (toTeamId set). Refreshes both the team sweep (the row leaves /
  // moves) and the personal list (it lands there when going personal).
  const moveTeamDiagramOut = (id: string, toTeamId: string | null, folderId: string | null) => {
    if (!ownerId) return;
    void apiSetDiagramFolder(ownerId, id, folderId, toTeamId)
      .catch(() => {})
      .then(() => {
        refreshTeamLibraries();
        void refreshPersonal(ownerId);
      });
    track('Team', toTeamId === null ? 'Removed' : 'Moved', 'Diagram');
  };

  // One entry point for the unified move picker (spec/35): route a
  // pick to the right handler from the subject's CURRENT placement
  // (personal vs which team) and its destination.
  const moveDiagramTo = (id: string, dest: { teamId: string | null; folderId: string | null }) => {
    const fromTeamId = teamDiagrams.find((d) => d.id === id)?.team.id ?? null;
    if (fromTeamId === null) {
      // Currently personal: file into a folder, or hand off to a team.
      if (dest.teamId === null) moveDiagramToFolder(id, dest.folderId);
      else moveDiagramToTeam(id, dest.teamId, dest.folderId);
      return;
    }
    // Currently in a team: re-folder within it, or move it out
    // (to personal, or on to another team).
    if (dest.teamId === fromTeamId) moveTeamDiagramToFolder(id, fromTeamId, dest.folderId);
    else moveTeamDiagramOut(id, dest.teamId, dest.folderId);
  };

  const openMovePickerForDiagram = (id: string, anchor: HTMLElement | null) => {
    moveAnchorRef.current = anchor;
    setMoveTarget({ kind: 'diagram', id });
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

  // Team destinations for the move picker (diagram moves only): each
  // team with its folder tree, so a diagram can land in a team folder
  // in one move. Folders carry parentId for the indented tree. An
  // offline diagram (spec/76) gets none — a team's shared library is
  // server-side, so a team move could never land.
  const moveTeamDests = useMemo(() => {
    if (
      moveTarget?.kind === 'diagram' &&
      diagrams.find((d) => d.id === moveTarget.id)?.ownerId === OFFLINE_OWNER_ID
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
  }, [teams, teamFolders, moveTarget, diagrams]);

  return {
    moveTarget,
    setMoveTarget,
    moveAnchorRef,
    moveFolderToParent,
    moveDiagramToTeam,
    moveTeamDiagramToFolder,
    moveTeamDiagramOut,
    moveDiagramTo,
    openMovePickerForDiagram,
    openMovePickerForFolder,
    movePersonalFolders,
    moveTeamDests,
  };
}
