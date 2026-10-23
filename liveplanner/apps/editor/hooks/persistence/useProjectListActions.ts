// List-level project + folder operations shared by every surface that
// renders a project library: the editor's Explorer (composed
// into the editor via useProjectActions), the /explorer page, and
// /new. Each surface owns its own list STATE (the editor refreshes it
// after autosave, the pages fetch on mount); this hook owns the
// BEHAVIOUR: the optimistic update, the API call, the telemetry, and
// the confirm copy, so the three surfaces can't drift. (They had:
// the pages were missing the Moved / Duplicated telemetry, and /new
// dismissed Shared rows without the confirm.)

import { EXPLORER_LANDING_PATH } from '@/lib/explorer-landing';
import { truncateName } from '@liveplanner/project';
import type { Dispatch, SetStateAction } from 'react';
import {
  apiDeleteProject,
  apiDismissSharedWith,
  apiSaveProjectMeta,
  apiSetProjectFolder,
  type ProjectListItem,
  type SharedWithItem,
} from '@/lib/api-client';
import { duplicateProject as duplicate } from '@/lib/duplicate-project';
import { markProjectDeleted, unmarkProjectDeleted } from '@/lib/project-tombstones';
import { handOffDeleteUndo, offerDeleteUndo, type DeletedTrash } from '@/lib/project-delete-undo';
import { logMoveFailure } from '@/lib/move-failure';
import { PROJECT_FAILURE, FOLDER_FAILURE } from '@/lib/write-failure-copy';
import { projectDuplicatedMessage, projectMovedMessage } from '@/lib/project-toast-copy';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { folderDeleteConfirmation } from '@/lib/folder-delete-confirmation';
import { folderDefaultKeys } from '@/lib/placement-defaults/default-destination';
import { placementDefaultsSnapshot } from '@/lib/placement-defaults/placement-defaults-store';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import type { useToast } from '@/hooks/ui/useToast';
import { assignAppLocation } from '@/lib/app-location';

// A personal folder as a delete needs it: its name and where it sits.
export type FolderNode = { id: string; name: string; parentId: string | null };

type ProjectListActionsDeps = {
  // The resolved owner id. Null / placeholder while identity is still
  // resolving; every op no-ops until a real id lands (matches what
  // each surface previously guarded by hand).
  ownerId: string | null;
  projectList: ProjectListItem[];
  setProjectList: Dispatch<SetStateAction<ProjectListItem[]>>;
  confirm: ReturnType<typeof useConfirm>;
  // Confirmation / error toasts for the consequential list actions
  // (delete, move-to-folder, duplicate) whose result is otherwise
  // silent or off-screen. Single-sourced here so all three surfaces
  // (editor panel, /explorer, /new) get the same feedback. Success
  // toasts respect the user's "Show notifications" preference;
  // errors always surface (see useToast).
  toast: ReturnType<typeof useToast>;
  // useFolders' delete. deleteFolder below chains the project-side
  // cascade in front of it so rows visibly move up to the deleted folder's
  // parent instead of waiting for the next list refresh. Only DIRECT
  // children move, mirroring the server (docs/specs/013-workspace/folders.md
  // "Deleting a folder": subfolders keep their own contents).
  deleteFolderFromHook: (id: string) => Promise<boolean>;
  // The personal folders, so the confirmation names the parent. Absent = [].
  folders?: readonly FolderNode[];
  // The project currently open in the editor, if the surface has
  // one. deleteProject redirects to /live/explorer when deleting it
  // (the editor would otherwise stare at a row that no longer
  // exists) and openProject no-ops on it. The standalone pages have
  // no current project and omit it.
  currentProject?: { id: string; name: string } | null;
  // What to do once a duplicate exists: the editor opens the copy,
  // the standalone pages stay put and refresh their list.
  afterDuplicate: (newId: string) => void | Promise<void>;
  // Shared-with-you list state, for dismissSharedProject. Optional:
  // surfaces without a Shared section omit both.
  sharedProjects?: SharedWithItem[];
  setSharedProjects?: Dispatch<SetStateAction<SharedWithItem[]>>;
};

export function useProjectListActions(deps: ProjectListActionsDeps) {
  const {
    ownerId,
    projectList,
    setProjectList,
    confirm,
    toast,
    deleteFolderFromHook,
    folders = [],
    currentProject = null,
    afterDuplicate,
    sharedProjects = [],
    setSharedProjects,
  } = deps;

  // Open a project from a list row. The current project (editor only)
  // is already autosaved, so a hard navigation loses nothing; path
  // scheme per docs/specs/007-editor/new-project-route.md. Shared-list rows pass a share code so the
  // non-owner can actually load the target; without it the editor's
  // hydration goes through the owner-only `/api/projects/:id` path
  // and 404s.
  const openProject = (id: string, shareCode?: string) => {
    if (typeof window === 'undefined') return;
    if (id === currentProject?.id) return;
    const url = shareCode
      ? `${window.location.origin}/project/${id}?s=${encodeURIComponent(shareCode)}`
      : `${window.location.origin}/project/${id}`;
    assignAppLocation(url);
  };

  // Rename a project from its list row. Optimistic; empty input is a
  // cancel, and the telemetry only fires when the name actually
  // changed.
  const renameProject = (id: string, name: string) => {
    if (!ownerId) return;
    // docs/specs/006-project/name-length.md: one cap for every rename route.
    const trimmed = truncateName(name);
    if (!trimmed) return;
    const prev = projectList.find((d) => d.id === id);
    const prevName = prev?.name?.trim() ?? '';
    setProjectList((p) => p.map((d) => (d.id === id ? { ...d, name: trimmed } : d)));
    void apiSaveProjectMeta(ownerId, { id, name: trimmed })
      // Only once the server accepted it. Emitting beside the request counted
      // renames the very next line rolls back and toasts as failures.
      .then(() => {
        if (trimmed !== prevName) track('Project', 'Renamed');
      })
      .catch(() => {
        // Roll the optimistic rename back and surface the failure, matching
        // the other consequential list actions (delete / move / duplicate)
        // — a silent swallow left the row showing a name the server rejected.
        if (prev)
          setProjectList((p) => p.map((d) => (d.id === id ? { ...d, name: prev.name } : d)));
        toast.error(PROJECT_FAILURE.rename(prevName));
      });
  };

  // Delete a project by id (docs/specs/013-workspace/trash.md "Deleting"): no question first, it only goes to the
  // Trash, and "Project deleted" carries an Undo that restores it. When the target is the currently-open one (editor
  // only), redirect to the Explorer, which offers the Undo on arrival. Deleting any other project removes the row
  // optimistically: a fire-and-forget DELETE followed by an immediate list refetch used to race, repainting the row the
  // API hadn't yet committed. The delete is awaited: a failure puts the row back and says so.
  //
  // `beforeRemove` runs before the row is pulled, so the caller can play a row exit animation (the panel slides it out
  // ~220ms). `onRestored` runs after an Undo, for a row this list does not hold (the panel's team rows).
  const deleteProject = async (
    id: string,
    beforeRemove?: () => Promise<void> | void,
    opts?: { onRestored?: () => void; name?: string },
  ) => {
    if (typeof window === 'undefined' || !ownerId) return;
    const listed = projectList.find((d) => d.id === id);
    // The name the toast shows: a caller's (a team row this list does not hold), else the row's, else the open one's.
    const name =
      opts?.name ?? listed?.name ?? (id === currentProject?.id ? currentProject.name : undefined);
    // Which Trash it goes to: this browser's for an offline project, the team's for one the person's list does not
    // hold (a team project, open or in the panel's team rows), else the person's own.
    const trash: DeletedTrash = !listed
      ? 'Team'
      : listed.ownerId === OFFLINE_OWNER_ID
        ? 'Local'
        : 'Personal';
    // Tombstone first, ALWAYS: the open editor's autosave (debounce + the
    // beforeunload keepalive beacon) must not write this project back. For
    // the open project that's the bug fix; for others it's harmless (their
    // editor isn't mounted) but keeps the rule simple. See project-tombstones.
    markProjectDeleted(id);
    if (id === currentProject?.id) {
      // AWAIT the delete before navigating: a fire-and-forget DELETE has no
      // keepalive, so the immediate navigation below would cancel the
      // in-flight request and the project would survive (the "didn't delete
      // first time" report). Awaiting sends it to completion first; the
      // tombstone then stops the beforeunload flush from re-creating it.
      // Telemetry rides the resolved delete, not the click: this used to fire
      // before the request was even sent. Emitting here is still delivered
      // despite the navigation below, because the client flushes its buffer
      // through sendBeacon on pagehide (@liveplanner/telemetry-client).
      await apiDeleteProject(ownerId, id)
        .then(() => {
          track('Project', 'Deleted');
          handOffDeleteUndo(id, trash, name);
        })
        .catch(() => {});
      // Straight to the landing section: `/explorer` is only an index that redirects, one more page
      // between the delete and the Explorer for something to flash on.
      assignAppLocation(`${window.location.origin}${EXPLORER_LANDING_PATH}`);
      return;
    }
    await beforeRemove?.();
    const at = projectList.findIndex((d) => d.id === id);
    const row = projectList[at];
    setProjectList((prev) => prev.filter((d) => d.id !== id));
    try {
      await apiDeleteProject(ownerId, id);
    } catch (err) {
      // The project is still there: put its row back where it was, lift the
      // tombstone so its editor may save again, and say so rather than
      // claiming a delete that never happened.
      console.warn('[explorer] delete-failed, row restored', err);
      unmarkProjectDeleted(id);
      if (row) {
        setProjectList((prev) =>
          prev.some((d) => d.id === id) ? prev : [...prev.slice(0, at), row, ...prev.slice(at)],
        );
      }
      toast.error(PROJECT_FAILURE.delete(name));
      return;
    }
    track('Project', 'Deleted');
    // The row is gone but on a long / scrolled list its disappearance can be easy to miss: say so, and offer it back.
    offerDeleteUndo(toast, {
      ownerId,
      id,
      name,
      trash,
      // Restored exactly as it was (trash.md "Restoring"), so the row it had goes back where it was.
      onRestored: () => {
        if (row) {
          setProjectList((prev) =>
            prev.some((d) => d.id === id) ? prev : [...prev.slice(0, at), row, ...prev.slice(at)],
          );
        }
        opts?.onRestored?.();
      },
    });
  };

  // Delete a folder (docs/specs/013-workspace/folders.md "Deleting a folder"): confirm (naming
  // where the contents go, and warning when it is one of the reader's default folders), move its
  // direct projects up to its parent locally, then let useFolders handle the folder rows + the
  // API call. `name` personalises the confirm
  // title when the caller has it. Returns whether the delete went
  // through, so callers with selection state (the /explorer sidebar)
  // can bounce focus only on an actual delete.
  const deleteFolder = async (id: string, name?: string): Promise<boolean> => {
    const folder = folders.find((f) => f.id === id);
    const parentId = folder?.parentId ?? null;
    const ok = await confirm(
      folderDeleteConfirmation({
        name: name ?? folder?.name ?? '',
        parentName: folders.find((f) => f.id === parentId)?.name ?? null,
        scope: 'personal',
        defaultKeys: folderDefaultKeys(id, placementDefaultsSnapshot().defaults),
      }),
    );
    if (!ok) return false;
    const movedUp = new Set(projectList.filter((d) => d.folderId === id).map((d) => d.id));
    setProjectList((prev) =>
      prev.map((d) => (d.folderId === id ? { ...d, folderId: parentId } : d)),
    );
    if (await deleteFolderFromHook(id)) return true;
    // Refused: useFolders put the folder back; its projects go back into it too.
    setProjectList((prev) =>
      prev.map((d) => (movedUp.has(d.id) && d.folderId === parentId ? { ...d, folderId: id } : d)),
    );
    toast.error(FOLDER_FAILURE.delete(name ?? folder?.name));
    return false;
  };

  const moveProjectToFolder = (id: string, folderId: string | null) => {
    if (!ownerId) return;
    const moved = projectList.find((d) => d.id === id);
    const prevFolderId = moved?.folderId ?? null;
    setProjectList((prev) => prev.map((d) => (d.id === id ? { ...d, folderId } : d)));
    void apiSetProjectFolder(ownerId, id, folderId)
      .then(() => {
        // The row leaves the current view (it's now under the target
        // folder / the root), so confirm where it went — only once the
        // server actually accepted the move.
        const folderName = folders.find((f) => f.id === folderId)?.name ?? '';
        toast.success(
          projectMovedMessage(moved?.name, folderId ? { folder: folderName } : 'my-projects'),
        );
        track('Project', 'Moved');
      })
      .catch((err: unknown) => {
        logMoveFailure('project', ` project=${id}`, err);
        // Roll the row back to its old folder and tell the user, instead
        // of swallowing the error after already claiming success.
        setProjectList((prev) =>
          prev.map((d) => (d.id === id ? { ...d, folderId: prevFolderId } : d)),
        );
        toast.error(PROJECT_FAILURE.move(moved?.name));
      });
  };

  // Duplicate a project into a brand-new one (new tab ids, preserved
  // element ids, tab-link references remapped; see
  // lib/duplicate-project). The surface decides what happens next via
  // afterDuplicate: open the copy (editor) or refresh the list
  // (standalone pages).
  const duplicateProject = async (id: string) => {
    if (!ownerId) return;
    const name = projectList.find((d) => d.id === id)?.name;
    const newId = await duplicate(ownerId, id);
    if (newId) {
      track('Project', 'Duplicated');
      // Surfaces that stay put (the pages) get a confirmation; the
      // editor's afterDuplicate navigates to the copy, so its own
      // open is the feedback and this toast is simply preempted.
      toast.success(projectDuplicatedMessage(name));
      await afterDuplicate(newId);
    } else {
      toast.error(PROJECT_FAILURE.duplicate(name));
    }
  };

  // Dismiss a single "shared with you" row. Confirmed because the row
  // is only re-creatable by re-opening the share link.
  const dismissSharedProject = async (projectId: string) => {
    if (!ownerId || !setSharedProjects) return;
    const target = sharedProjects.find((d) => d.id === projectId);
    const ok = await confirm({
      title: `Remove "${target?.name || 'this plan'}" from Shared With Me?`,
      message:
        "It'll vanish from your Shared with you list. You can still open it again from the share link the owner gave you, and that re-adds it here.",
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setSharedProjects((prev) => prev.filter((d) => d.id !== projectId));
    void apiDismissSharedWith(ownerId, projectId).catch(() => {});
  };

  return {
    openProject,
    renameProject,
    deleteProject,
    deleteFolder,
    moveProjectToFolder,
    duplicateProject,
    dismissSharedProject,
  };
}
