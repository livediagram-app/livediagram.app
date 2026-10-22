// Project-level lifecycle + navigation for the EDITOR surface. The
// list-level operations (open / rename / delete / move / duplicate /
// folder delete / dismiss shared) live in useProjectListActions,
// shared with /explorer and /new; this hook wires them to the
// editor's state (current project, Explorer list, shared list) and
// adds the two editor-only actions: newProject (hand off to /live/new)
// and makeCopy (visitor copies the open shared project).
//
// Navigation is deliberately a hard `window.location.assign` rather
// than client routing: the editor's hydration path owns identity +
// load, and the current project is already autosaved, so a reload is
// the simplest correct handoff (docs/specs/007-editor/new-project-route.md).

import type { Dispatch, SetStateAction } from 'react';
import {
  apiCopyProject,
  apiSetProjectFolder,
  type ProjectListItem,
  type SharedWithItem,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import { useProjectListActions } from '@/hooks/persistence/useProjectListActions';
import type { FolderNode } from '@/hooks/persistence/useProjectListActions';
import { useToast } from '@/hooks/ui/useToast';
import { projectMovedMessage } from '@/lib/project-toast-copy';
import { PROJECT_FAILURE } from '@/lib/write-failure-copy';

type ProjectActionsDeps = {
  projectId: string | null;
  projectName: string;
  projectList: ProjectListItem[];
  setProjectList: Dispatch<SetStateAction<ProjectListItem[]>>;
  confirm: ReturnType<typeof useConfirm>;
  ownerId: string;
  // useFolders' delete, wrapped by the shared hook with a
  // project-side re-bucket.
  hookDeleteFolder: (id: string) => Promise<boolean>;
  // The personal folders, so a folder delete can say where its contents go.
  folders: readonly FolderNode[];
  // Shared-with-you list, for the dismiss action surfaced in the
  // Explorer panel's Shared accordion.
  sharedProjects: SharedWithItem[];
  setSharedProjects: Dispatch<SetStateAction<SharedWithItem[]>>;
  copying: boolean;
  setCopying: (copying: boolean) => void;
  // The session's share code (edit/view visitors), forwarded to the
  // copy endpoint for authorisation.
  sessionShareCode: string | null;
  // Post-move refreshes for the scope-aware mover below: the team
  // libraries sweep (a row moved within / left a team) and the personal
  // list (a project landed in — or left — My Work).
  refreshTeamLibraries: () => void;
  refreshProjectList: () => Promise<void> | void;
  // Fired after a successful scope-aware move so the editor can sync any
  // state derived from the moved project's placement — the header's
  // Private / Team badge reads the CURRENT project's teamId, which
  // otherwise goes stale until a reload.
  onProjectScopeChanged?: (projectId: string, teamId: string | null) => void;
};

export function useProjectActions(deps: ProjectActionsDeps) {
  const {
    projectId,
    projectName,
    projectList,
    setProjectList,
    confirm,
    ownerId,
    hookDeleteFolder,
    folders,
    sharedProjects,
    setSharedProjects,
    copying,
    setCopying,
    sessionShareCode,
    refreshTeamLibraries,
    refreshProjectList,
    onProjectScopeChanged,
  } = deps;

  const toast = useToast();

  const {
    openProject,
    deleteProject,
    deleteFolder,
    moveProjectToFolder,
    duplicateProject,
    dismissSharedProject,
  } = useProjectListActions({
    ownerId,
    projectList,
    setProjectList,
    confirm,
    toast,
    deleteFolderFromHook: hookDeleteFolder,
    folders,
    currentProject: projectId ? { id: projectId, name: projectName } : null,
    // Open the freshly created copy. Navigation reloads the editor
    // onto the new id, so a separate list refresh is unnecessary.
    afterDuplicate: (newId) => openProject(newId),
    sharedProjects,
    setSharedProjects,
  });

  // Scope-crossing move (docs/specs/013-workspace/team-shared-projects.md), for the Explorer panel's move picker
  // when a TEAM is involved on either side: re-folder within a team, file
  // a personal project into a team, or bring a team project back to the
  // personal tree (ownership transfers to the mover server-side). One API
  // call covers every case; afterwards both the team sweep and the
  // personal list refresh so the row surfaces wherever it landed.
  // (Purely personal moves stay on moveProjectToFolder above — it updates
  // the list optimistically.)
  //
  // Telemetry (docs/specs/017-telemetry/telemetry.md), on the success path only: a personal project
  // filed into a team is Team·Added·Project, the same event the Explorer
  // page's own move and the New Project wizard send; anything else (within
  // a team, team -> team, team -> personal) is Team·Moved·Project. An
  // unknown source (a caller that doesn't pass `fromTeamId`, e.g. the team
  // library, whose rows are always team projects) reads as a team move.
  const moveProjectTo = (
    id: string,
    dest: { teamId: string | null; folderId: string | null },
    fromTeamId?: string | null,
  ) => {
    // Named in the toast when this editor knows it: the open project, or a row of the personal list.
    const name = id === projectId ? projectName : projectList.find((d) => d.id === id)?.name;
    void apiSetProjectFolder(ownerId, id, dest.folderId, dest.teamId)
      .then(() => {
        refreshTeamLibraries();
        void refreshProjectList();
        onProjectScopeChanged?.(id, dest.teamId);
        toast.success(projectMovedMessage(name, dest.teamId ? { team: '' } : 'my-projects'));
        if (fromTeamId === null && dest.teamId) track('Team', 'Added', 'Project');
        else track('Team', 'Moved', 'Project');
      })
      .catch(() => {
        toast.error(PROJECT_FAILURE.move(name));
      });
  };

  // "New Project" from the Explorer. Welcome / create-new lives at
  // /live/new (docs/specs/007-editor/new-project-route.md), so hand off there; that route owns the
  // identity + template + theme picker and the actual project POST.
  // The current project is already autosaved so nothing is lost.
  const newProject = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/new`);
  };

  // Visitor action: duplicate the currently-open shared project
  // into the caller's own files. Goes to the api worker's copy
  // endpoint which authorises via owner / shared_with row / share
  // code (docs/specs/015-api/api.md), then navigates to the new project so the
  // visitor immediately lands on their own copy. Owner case never
  // hits this; the button is gated on `!isOwner`.
  const makeCopy = async () => {
    if (!projectId || copying) return;
    setCopying(true);
    try {
      const copy = await apiCopyProject(ownerId, projectId, {
        shareCode: sessionShareCode,
      });
      // A visitor cloning someone else's shared project into their own
      // account; a distinct signal from duplicating your own (type 'Copy').
      track('Project', 'Duplicated', 'Copy');
      window.location.assign(`${window.location.origin}/project/${copy.id}`);
    } catch {
      // Network / auth glitch; let the user try again. Leave the
      // header button enabled by clearing the loading flag.
      setCopying(false);
    }
  };

  return {
    deleteProject,
    deleteFolder,
    moveProjectToFolder,
    moveProjectTo,
    duplicateProject,
    dismissSharedProject,
    newProject,
    openProject,
    makeCopy,
  };
}
