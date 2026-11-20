'use client';

// The offer to delete from storage the pictures a delete left unused (docs/specs/009-elements/images.md "Deleting an
// unused picture"): @liveworkspace/workbench's useUnusedImagePrompt over this editor's tabs, api and gate. It hands
// back what useElementSelectionActions calls with the elements a delete took. Nothing is read until then: the tabs
// are read from their ref and the api asked once a delete has removed an image element.
import type { RefObject } from 'react';
import type { Element, Tab } from '@livediagram/document';
import { useUnusedImagePrompt } from '@liveworkspace/workbench/hooks/editor/useUnusedImagePrompt';
import {
  everyTabLoaded,
  mayOfferUnusedImages,
  picturesOfTabs,
} from '@liveworkspace/workbench/lib/unused-image-prompt';
import {
  readUnusedImageChoice,
  withUnusedImageChoice,
} from '@liveworkspace/workbench/lib/unused-image-choice';
import { apiDeleteImage, apiUnusedImages } from '@/lib/api-client';
import { tabImageIds } from '@/lib/offline/offline-images';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import type { UserPreferences } from '@/lib/user-preferences';

type Deps = {
  // The person the gallery speaks for (the editor's own participant id).
  ownerId: string;
  documentId: string | null;
  // The signed-in account; null or undefined for a guest, or before sign-in has answered.
  accountUserId: string | null | undefined;
  embedMode: boolean;
  workbenchMode: boolean;
  // A Viewer or a tab-scoped link's visitor.
  isStructureReadOnly: boolean;
  // A Participant.
  participating: boolean;
  tabsRef: RefObject<Tab[]>;
  loadedTabIdsRef: RefObject<Set<string>>;
  // Fetches every tab not loaded yet; answers the ones that failed.
  loadAllTabs: () => Promise<string[]>;
  // The person's preferences: When I Delete an Unused Image is read from them, and Remember My Choice saves to them.
  userPreferences: UserPreferences;
  setUserPreferences: (next: UserPreferences) => void;
};

export function useUnusedImageOffer(deps: Deps): (removed: Element[]) => void {
  const { ownerId, documentId, tabsRef, loadedTabIdsRef, loadAllTabs } = deps;
  const offer = useUnusedImagePrompt({
    enabled: mayOfferUnusedImages({
      itemId: documentId,
      signedIn: typeof deps.accountUserId === 'string',
      offline: documentId !== null && isOfflineIdSync(documentId),
      embedded: deps.embedMode,
      workbench: deps.workbenchMode,
      structureReadOnly: deps.isStructureReadOnly,
      participating: deps.participating,
    }),
    placed: () => picturesOfTabs(tabsRef.current, tabImageIds),
    allTabsLoaded: () => everyTabLoaded(tabsRef.current, loadedTabIdsRef.current),
    loadAllTabs: async () => (await loadAllTabs()).length === 0,
    // The gate holds a document before anything is asked.
    check: (ids) => apiUnusedImages(ownerId, documentId ?? '', ids),
    remove: (id) => apiDeleteImage(ownerId, id),
    choice: () => readUnusedImageChoice(deps.userPreferences),
    remember: (choice) =>
      deps.setUserPreferences(withUnusedImageChoice(deps.userPreferences, choice)),
  });
  return (removed) => offer(tabImageIds({ elements: removed }));
}
