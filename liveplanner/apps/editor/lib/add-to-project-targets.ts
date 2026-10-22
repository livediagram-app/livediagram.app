import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';

// The projects the tab menu's Add to Project offers (docs/specs/006-project/tab-project-many-to-many.md).
// Linking is a server-side row insert that only the project's owner may make, so the list is empty, which
// disables the row, whenever the call could only fail:
//   - an offline project, whose tabs live in this browser only (docs/specs/006-project/offline-mode.md);
//   - a workbench, which reaches its one project only;
//   - a project you don't own (an Editor on someone else's link): the api refuses a tab that lives in no
//     project of yours.
// Offline projects are never destinations either.
export function addToProjectTargets<D extends { id: string; ownerId: string }>(input: {
  projectId: string | null;
  projectList: readonly D[];
  isOffline: boolean;
  workbench: boolean;
  isOwner: boolean;
}): D[] {
  if (input.isOffline || input.workbench || !input.isOwner) return [];
  return input.projectList.filter(
    (d) => d.id !== input.projectId && d.ownerId !== OFFLINE_OWNER_ID,
  );
}
