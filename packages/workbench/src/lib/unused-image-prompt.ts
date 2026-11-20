// Deleting an unused picture (each product's docs/specs/009-elements/images.md "Deleting an unused picture"): after a
// delete removes image elements, the editor offers to delete from storage the pictures nothing else uses. Never
// before the delete, never without a press, and never when anything is unsure: a picture this item still places
// (re-read at each step, so an undo in the meantime keeps it), one the api doesn't answer as unused (another item in
// any app, the Trash included, a Library item, an unconfirmed reference; liveworkspace/docs/specs/006-media/media.md
// "Unused after a delete"), and any when a tab can't be loaded or the request fails, are kept. One request a delete,
// for at most UNUSED_IMAGE_IDS_MAX pictures; the tabs load only once the api has answered one unused. The person's
// setting (./unused-image-choice.ts) decides the end: Ask offers, Always Delete deletes after the same checks and says
// so, Always Keep asks nothing and sends nothing; the offer's Remember My Choice saves the answer pressed as it.
// Pure apart from what it is handed; the editors mount it through useUnusedImagePrompt.

import { isGalleryImageId, UNUSED_IMAGE_IDS_MAX } from '@liveworkspace/media';
import type { ToastApi } from '@liveworkspace/ui/toast';
import type { UnusedImageChoice } from './unused-image-choice';

/** The one toast the offer is, upserted in place: a newer delete's offer replaces an older one's. */
export const UNUSED_IMAGE_TOAST_KEY = 'unused-images';

export type UnusedImagePromptDeps = {
  /** Every gallery picture the item places now, on every tab loaded here: read fresh at each step. */
  placed: () => ReadonlySet<string>;
  /** Whether every tab of the item is loaded here, so `placed` is the whole item. */
  allTabsLoaded: () => boolean;
  /** Loads every tab not loaded yet; true once all are, false when one failed. */
  loadAllTabs: () => Promise<boolean>;
  /** The api's answer: which of `ids` nothing but this item uses. Anything but an answer is `[]`. */
  check: (ids: string[]) => Promise<readonly string[]>;
  /** Deletes one picture from storage (`DELETE /api/images/:id`). */
  remove: (id: string) => Promise<void>;
  toast: Pick<ToastApi, 'action' | 'dismissAction' | 'error'>;
  /** The person's setting, read at each delete and again before the end. Ask when not given. */
  choice?: () => UnusedImageChoice;
  /** Saves the answer pressed as the setting, when Remember My Choice is on. Without it the offer has no switch. */
  remember?: (choice: Exclude<UnusedImageChoice, 'ask'>) => void;
  /** Waits for the editor's state to show the last change (the delete, a loaded tab). A task by default. */
  settle?: () => Promise<void>;
};

/** Who an editor may make the offer to (images.md "Only the picture's owner"): signed in, in an item saved to their
 *  account, with the whole of it open to them as its owner or an Editor. The api then answers only their own pictures. */
export type UnusedImageGate = {
  itemId: string | null;
  signedIn: boolean;
  offline: boolean;
  embedded: boolean;
  workbench: boolean;
  // A Viewer, or a tab-scoped link's visitor: the item's structure is read-only to them.
  structureReadOnly: boolean;
  // A Participant: they add content, but a delete of theirs asks nothing.
  participating: boolean;
};

export function mayOfferUnusedImages(gate: UnusedImageGate): boolean {
  return (
    gate.itemId !== null &&
    gate.signedIn &&
    !gate.offline &&
    !gate.embedded &&
    !gate.workbench &&
    !gate.structureReadOnly &&
    !gate.participating
  );
}

/** Every picture the tabs name, by the editor's own reader of a tab (its image elements', its pages' backgrounds). */
export function picturesOfTabs<T>(
  tabs: readonly T[],
  tabImageIds: (tab: T) => readonly string[],
): Set<string> {
  const ids = new Set<string>();
  for (const tab of tabs) for (const id of tabImageIds(tab)) ids.add(id);
  return ids;
}

/** Whether every tab is here whole: loaded, or holding elements (a tab made in this session). */
export function everyTabLoaded(
  tabs: readonly { id: string; elements: readonly unknown[] }[],
  loaded: ReadonlySet<string>,
): boolean {
  return tabs.every((tab) => loaded.has(tab.id) || tab.elements.length > 0);
}

/** The toast's words for `n` pictures: the offer, the answers' names, what a delete says after. */
export function unusedImageWords(n: number) {
  const one = n === 1;
  return {
    offer: one
      ? 'This image isn’t used anywhere else. Delete it from storage? It can’t be undone.'
      : `${n} images aren’t used anywhere else. Delete them from storage? It can’t be undone.`,
    keepLabel: one ? 'Keep: leave the image in storage' : `Keep: leave the ${n} images in storage`,
    deleteLabel: one ? 'Delete from Storage: the image' : `Delete from Storage: ${n} images`,
    deleted: one ? 'Deleted from storage' : `${n} images deleted from storage`,
    // Always Delete from Storage's notice, so it never happens silently.
    autoDeleted: one
      ? 'The image wasn’t used anywhere else, so it was deleted from storage.'
      : `${n} images weren’t used anywhere else, so they were deleted from storage.`,
    failed: one
      ? 'Couldn’t delete the image from storage. Try again.'
      : `Couldn’t delete ${n} images from storage. Try again.`,
  };
}

/** The next task: a delete made in an event handler has rendered by then. */
export const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The offer, made once per editor: `offer(removed)` after each delete, with the pictures its elements placed. */
export function createUnusedImagePrompt(deps: UnusedImagePromptDeps) {
  const settle = deps.settle ?? nextTask;
  // Only the newest delete may offer: an older one's answer arriving late never replaces it.
  let latest = 0;
  const notPlaced = (ids: readonly string[]) => {
    const placed = deps.placed();
    return ids.filter((id) => !placed.has(id));
  };

  const choice = () => deps.choice?.() ?? 'ask';
  // `auto`: Always Delete from Storage did it, not a press, so its notice says why and shows whatever the toasts.
  const deleteFromStorage = async (offered: readonly string[], auto: boolean) => {
    const going = notPlaced(offered);
    if (going.length === 0) {
      deps.toast.dismissAction(UNUSED_IMAGE_TOAST_KEY);
      return;
    }
    const results = await Promise.allSettled(going.map((id) => deps.remove(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) {
      const words = unusedImageWords(going.length);
      deps.toast.action({
        key: UNUSED_IMAGE_TOAST_KEY,
        message: auto ? words.autoDeleted : words.deleted,
        actions: [],
        ...(auto ? { important: true } : {}),
      });
      return;
    }
    deps.toast.dismissAction(UNUSED_IMAGE_TOAST_KEY);
    deps.toast.error(unusedImageWords(failed).failed);
  };

  return async function offer(removed: Iterable<string>): Promise<void> {
    const run = ++latest;
    // Always Keep: nothing to ask, so nothing is read.
    if (choice() === 'keep') return;
    const asked = [...new Set(removed)].filter(isGalleryImageId);
    if (asked.length === 0) return;
    // The delete lands first: what it removed is gone from `placed`, what another element holds is not.
    await settle();
    const candidates = notPlaced(asked).slice(0, UNUSED_IMAGE_IDS_MAX);
    if (candidates.length === 0 || run !== latest) return;
    let answered: readonly string[];
    try {
      answered = await deps.check(candidates);
    } catch {
      return;
    }
    const unused = candidates.filter((id) => answered.includes(id));
    if (unused.length === 0 || run !== latest) return;
    // A tab not opened here may place it: load them all (only now, and only on this path), or offer nothing.
    if (!deps.allTabsLoaded()) {
      if (!(await deps.loadAllTabs().catch(() => false))) return;
      await settle();
    }
    const offered = notPlaced(unused);
    if (offered.length === 0 || run !== latest) return;
    const now = choice();
    if (now === 'keep') return;
    if (now === 'delete') return deleteFromStorage(offered, true);
    const words = unusedImageWords(offered.length);
    // Remember My Choice: read only as an answer is pressed; closing or timing out saves nothing.
    let remember = false;
    const answer = (picked: Exclude<UnusedImageChoice, 'ask'>) => {
      if (remember) deps.remember?.(picked);
    };
    deps.toast.action({
      key: UNUSED_IMAGE_TOAST_KEY,
      message: words.offer,
      actions: [
        {
          label: 'Keep',
          ariaLabel: words.keepLabel,
          onSelect: () => {
            answer('keep');
            deps.toast.dismissAction(UNUSED_IMAGE_TOAST_KEY);
          },
        },
        {
          label: 'Delete from Storage',
          ariaLabel: words.deleteLabel,
          destructive: true,
          onSelect: () => {
            answer('delete');
            void deleteFromStorage(offered, false);
          },
        },
      ],
      ...(deps.remember
        ? {
            toggle: {
              label: 'Remember My Choice',
              onChange: (on: boolean) => {
                remember = on;
              },
            },
          }
        : {}),
    });
  };
}
