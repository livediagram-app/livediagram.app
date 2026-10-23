import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';

// The designs the tab menu's Add to Design offers (docs/specs/006-design/tab-design-many-to-many.md).
// Linking is a server-side row insert that only the design's owner may make, so the list is empty, which
// disables the row, whenever the call could only fail:
//   - an offline design, whose tabs live in this browser only (docs/specs/006-design/offline-mode.md);
//   - a workbench, which reaches its one design only;
//   - a design you don't own (an Editor on someone else's link): the api refuses a tab that lives in no
//     design of yours.
// Offline designs are never destinations either.
export function addToDesignTargets<D extends { id: string; ownerId: string }>(input: {
  designId: string | null;
  designList: readonly D[];
  isOffline: boolean;
  workbench: boolean;
  isOwner: boolean;
}): D[] {
  if (input.isOffline || input.workbench || !input.isOwner) return [];
  return input.designList.filter(
    (d) => d.id !== input.designId && d.ownerId !== OFFLINE_OWNER_ID,
  );
}
