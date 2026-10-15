'use client';

// What every part of the Form tab builder reads (docs/specs/030-forms/forms.md "Building a form"): the form, whether
// this person may change it, the selection, and the edits. Provided by FormPage.
import { createContext, useContext } from 'react';
import type { FormDefinition } from '@livediagram/forms';
import type { ItemTypeDef } from '@livediagram/items';
import type { FormActions } from '@/hooks/forms/useFormActions';
import type { FormSettingsSection } from './FormSettingsButton';

export type FormBuilderValue = {
  form: FormDefinition;
  canEdit: boolean;
  // Taking responses: its content is locked until Edit Form stops it (docs/specs/030-forms/forms.md "A live form is
  // locked"); `canEdit` is false meanwhile, and the cog's Settings stay open.
  locked?: boolean;
  // How many problems stop it taking responses (FormProblems): Accepting Responses stays off while any remain.
  problemCount?: number;
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
  // Opens the status bar's cog on a section (Answer Goes To's "choose where responses go" opens Responses Go To).
  openSettings: (section: FormSettingsSection | null) => void;
};

export const FormBuilderContext = createContext<FormBuilderValue | null>(null);

export function useFormBuilder(): FormBuilderValue {
  const value = useContext(FormBuilderContext);
  if (!value) throw new Error('useFormBuilder outside a Form tab');
  return value;
}
