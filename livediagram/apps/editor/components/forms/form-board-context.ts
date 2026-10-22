'use client';

// What a board's Form strip reads (docs/specs/030-forms/forms.md "On the board"): the forms sending their responses to
// the open Board tab, and how to reach the api and the tabs. Provided by the editor; absent elsewhere (a board drawn
// for an export, a test), where no strip is drawn.
import { createContext, useContext } from 'react';

export type FormFeedingBoard = { tabId: string; heading: string };

export type FormBoardValue = {
  // The forms whose responses go to the open tab, in tab order.
  forms: readonly FormFeedingBoard[];
  documentId: string | null;
  ownerId: string;
  share: string | null;
  online: boolean;
  // Whether this person may share the form (an Editor): Copy Link is theirs.
  canShare: boolean;
  openTab: (tabId: string) => void;
};

export const FormBoardContext = createContext<FormBoardValue | null>(null);

export const useFormBoard = (): FormBoardValue | null => useContext(FormBoardContext);
