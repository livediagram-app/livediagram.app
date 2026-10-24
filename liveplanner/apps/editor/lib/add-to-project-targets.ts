import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';

// The projects the tab menu's Add to Project offers (docs/specs/006-project/tab-project-many-to-many.md).
// The copy is saved through the server into one of your own plans, and is offered only from a plan you own, so the
// list is empty, which disables the row:
//   - in an offline project, whose tabs live in this browser only (docs/specs/006-project/offline-mode.md);
//   - in a workbench, which reaches its one project only;
//   - on a project you don't own (an Editor on someone else's link).
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
