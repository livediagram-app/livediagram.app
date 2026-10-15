'use client';

// What every part of the Form tab builder reads (docs/specs/030-forms/forms.md "Building a form"): the form, whether
// this person may change it, the selection, and the edits. Provided by FormPage.
import { createContext, useContext } from 'react';
import type { FormDefinition } from '@livediagram/forms';
import type { ItemTypeDef } from '@livediagram/items';
import type { FormActions } from '@/hooks/forms/useFormActions';

export type FormPanelTab = 'question' | 'destination' | 'settings';

export type FormBuilderValue = {
  form: FormDefinition;
  canEdit: boolean;
  actions: FormActions;
  selectedId: string | null;
  // `focus`: the question takes focus once drawn (one just added).
  select: (id: string | null, focus?: boolean) => void;
  // The question to take focus once drawn (one just added), cleared once taken.
  focusId: string | null;
  clearFocus: () => void;
  // The destination's card type, when it resolves; the document's types.
  type: ItemTypeDef | undefined;
  types: readonly ItemTypeDef[];
  // Opens the side panel on a tab (a question's Answer Goes To chip opens the Question tab).
  openPanel: (tab: FormPanelTab) => void;
};

export const FormBuilderContext = createContext<FormBuilderValue | null>(null);

export function useFormBuilder(): FormBuilderValue {
  const value = useContext(FormBuilderContext);
  if (!value) throw new Error('useFormBuilder outside a Form tab');
  return value;
}
