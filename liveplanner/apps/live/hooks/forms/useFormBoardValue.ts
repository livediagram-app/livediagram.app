'use client';

// The Form strip's context (components/forms/form-board-context.ts): the forms whose responses go to the open tab, read
// off the document's Form tabs, with the api details and tab opening the strip needs. Recomputed only when they change.
import { useMemo, useState } from 'react';
import type { Tab } from '@liveplanner/document';
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
  // Keyed on what the strip shows, so a tab edit elsewhere does not redraw every board header: while the key holds,
  // the array taken when it last changed stands (adjusted during render, so the change shows in this render).
  const key = feeding.map((f) => `${f.tabId}:${f.heading}`).join('|');
  const [held, setHeld] = useState({ key, forms: feeding });
  if (held.key !== key) setHeld({ key, forms: feeding });
  const forms = held.key === key ? held.forms : feeding;
  return useMemo(
    () => ({ forms, documentId, ownerId, share, online, canShare, openTab }),
    [forms, documentId, ownerId, share, online, canShare, openTab],
  );
}
