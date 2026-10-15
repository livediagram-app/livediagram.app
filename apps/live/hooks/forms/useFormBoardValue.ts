'use client';

// The Form strip's context (components/forms/form-board-context.ts): the forms whose responses go to the open tab, read
// off the document's Form tabs, with the api details and tab opening the strip needs. Recomputed only when they change.
import { useMemo } from 'react';
import type { Tab } from '@livediagram/document';
import type { FormBoardValue } from '@/components/forms/form-board-context';
import { formsFeeding } from './forms-feeding';

export function useFormBoardValue(input: {
  tabs: readonly Tab[];
  activeTabId: string;
  documentId: string | null;
  ownerId: string;
  share: string | null;
  online: boolean;
  canShare: boolean;
  openTab: (tabId: string) => void;
}): FormBoardValue {
  const { tabs, activeTabId, documentId, ownerId, share, online, canShare, openTab } = input;
  const feeding = formsFeeding(tabs, activeTabId);
  // Keyed on what the strip shows, so a tab edit elsewhere does not redraw every board header.
  const key = feeding.map((f) => `${f.tabId}:${f.heading}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for `feeding`, a fresh array each render.
  const forms = useMemo(() => feeding, [key]);
  return useMemo(
    () => ({ forms, documentId, ownerId, share, online, canShare, openTab }),
    [forms, documentId, ownerId, share, online, canShare, openTab],
  );
}
