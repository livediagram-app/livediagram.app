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
import { apiDeleteImage, apiUnusedImages } from '@/lib/api-client';
import { tabImageIds } from '@/lib/offline/offline-images';
import { isOfflineIdSync } from '@/lib/offline/offline-store';

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
  });
  return (removed) => offer(tabImageIds({ elements: removed }));
}
