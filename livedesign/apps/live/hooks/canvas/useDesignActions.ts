// Design-level lifecycle + navigation for the EDITOR surface. The
// list-level operations (open / rename / delete / move / duplicate /
// folder delete / dismiss shared) live in useDesignListActions,
// shared with /explorer and /new; this hook wires them to the
// editor's state (current design, Explorer list, shared list) and
// adds the two editor-only actions: newDesign (hand off to /live/new)
// and makeCopy (visitor copies the open shared design).
//
// Navigation is deliberately a hard `window.location.assign` rather
// than client routing: the editor's hydration path owns identity +
// load, and the current design is already autosaved, so a reload is
// the simplest correct handoff (docs/specs/007-editor/new-design-route.md).

import type { Dispatch, SetStateAction } from 'react';
import {
  apiCopyDesign,
  apiSetDesignFolder,
  type DesignListItem,
  type SharedWithItem,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import { useDesignListActions } from '@/hooks/persistence/useDesignListActions';
import type { FolderNode } from '@/hooks/persistence/useDesignListActions';
import { useToast } from '@/hooks/ui/useToast';
import { designMovedMessage } from '@/lib/design-toast-copy';
import { DESIGN_FAILURE } from '@/lib/write-failure-copy';

type DesignActionsDeps = {
  designId: string | null;
  designName: string;
  designList: DesignListItem[];
  setDesignList: Dispatch<SetStateAction<DesignListItem[]>>;
  confirm: ReturnType<typeof useConfirm>;
  ownerId: string;
  // useFolders' delete, wrapped by the shared hook with a
  // design-side re-bucket.
  hookDeleteFolder: (id: string) => Promise<boolean>;
  // The personal folders, so a folder delete can say where its contents go.
  folders: readonly FolderNode[];
  // Shared-with-you list, for the dismiss action surfaced in the
  // Explorer panel's Shared accordion.
  sharedDesigns: SharedWithItem[];
  setSharedDesigns: Dispatch<SetStateAction<SharedWithItem[]>>;
  copying: boolean;
  setCopying: (copying: boolean) => void;
  // The session's share code (edit/view visitors), forwarded to the
  // copy endpoint for authorisation.
  sessionShareCode: string | null;
  // Post-move refreshes for the scope-aware mover below: the team
  // libraries sweep (a row moved within / left a team) and the personal
  // list (a design landed in — or left — My Work).
  refreshTeamLibraries: () => void;
  refreshDesignList: () => Promise<void> | void;
  // Fired after a successful scope-aware move so the editor can sync any
  // state derived from the moved design's placement — the header's
  // Private / Team badge reads the CURRENT design's teamId, which
  // otherwise goes stale until a reload.
  onDesignScopeChanged?: (designId: string, teamId: string | null) => void;
};

export function useDesignActions(deps: DesignActionsDeps) {
  const {
    designId,
    designName,
    designList,
    setDesignList,
    confirm,
    ownerId,
    hookDeleteFolder,
    folders,
    sharedDesigns,
    setSharedDesigns,
    copying,
    setCopying,
    sessionShareCode,
    refreshTeamLibraries,
    refreshDesignList,
    onDesignScopeChanged,
  } = deps;

  const toast = useToast();

  const {
    openDesign,
    deleteDesign,
    deleteFolder,
    moveDesignToFolder,
    duplicateDesign,
    dismissSharedDesign,
  } = useDesignListActions({
    ownerId,
    designList,
    setDesignList,
    confirm,
    toast,
    deleteFolderFromHook: hookDeleteFolder,
    folders,
    currentDesign: designId ? { id: designId, name: designName } : null,
    // Open the freshly created copy. Navigation reloads the editor
    // onto the new id, so a separate list refresh is unnecessary.
    afterDuplicate: (newId) => openDesign(newId),
    sharedDesigns,
    setSharedDesigns,
  });

  // Scope-crossing move (docs/specs/013-workspace/team-shared-designs.md), for the Explorer panel's move picker
  // when a TEAM is involved on either side: re-folder within a team, file
  // a personal design into a team, or bring a team design back to the
  // personal tree (ownership transfers to the mover server-side). One API
  // call covers every case; afterwards both the team sweep and the
  // personal list refresh so the row surfaces wherever it landed.
  // (Purely personal moves stay on moveDesignToFolder above — it updates
  // the list optimistically.)
  //
  // Telemetry (docs/specs/017-telemetry/telemetry.md), on the success path only: a personal design
  // filed into a team is Team·Added·Document, the same event the Explorer
  // page's own move and the New Design wizard send; anything else (within
  // a team, team -> team, team -> personal) is Team·Moved·Document. An
  // unknown source (a caller that doesn't pass `fromTeamId`, e.g. the team
  // library, whose rows are always team designs) reads as a team move.
  const moveDesignTo = (
    id: string,
    dest: { teamId: string | null; folderId: string | null },
    fromTeamId?: string | null,
  ) => {
    // Named in the toast when this editor knows it: the open design, or a row of the personal list.
    const name = id === designId ? designName : designList.find((d) => d.id === id)?.name;
    void apiSetDesignFolder(ownerId, id, dest.folderId, dest.teamId)
      .then(() => {
        refreshTeamLibraries();
        void refreshDesignList();
        onDesignScopeChanged?.(id, dest.teamId);
        toast.success(designMovedMessage(name, dest.teamId ? { team: '' } : 'my-designs'));
        if (fromTeamId === null && dest.teamId) track('Team', 'Added', 'Design');
        else track('Team', 'Moved', 'Design');
      })
      .catch(() => {
        toast.error(DESIGN_FAILURE.move(name));
      });
  };

  // "New Design" from the Explorer. Welcome / create-new lives at
  // /live/new (docs/specs/007-editor/new-design-route.md), so hand off there; that route owns the
  // identity + template + theme picker and the actual design POST.
  // The current design is already autosaved so nothing is lost.
  const newDesign = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/new`);
  };

  // Visitor action: duplicate the currently-open shared design
  // into the caller's own files. Goes to the api worker's copy
  // endpoint which authorises via owner / shared_with row / share
  // code (docs/specs/015-api/api.md), then navigates to the new design so the
  // visitor immediately lands on their own copy. Owner case never
  // hits this; the button is gated on `!isOwner`.
  const makeCopy = async () => {
    if (!designId || copying) return;
    setCopying(true);
    try {
      const copy = await apiCopyDesign(ownerId, designId, {
        shareCode: sessionShareCode,
      });
      // A visitor cloning someone else's shared design into their own
      // account; a distinct signal from duplicating your own (type 'Copy').
      track('Document', 'Duplicated', 'Copy');
      window.location.assign(`${window.location.origin}/design/${copy.id}`);
    } catch {
      // Network / auth glitch; let the user try again. Leave the
      // header button enabled by clearing the loading flag.
      setCopying(false);
    }
  };

  return {
    deleteDesign,
    deleteFolder,
    moveDesignToFolder,
    moveDesignTo,
    duplicateDesign,
    dismissSharedDesign,
    newDesign,
    openDesign,
    makeCopy,
  };
}
