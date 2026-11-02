'use client';

// The editor's door for a new card (docs/specs/026-plan/item-types.md "Required fields"): a card whose type requires
// a custom field it lacks waits for the New {Type} dialog (RequiredFieldsDialog) to fill it. Every way the editor
// makes one card goes through usePlanSlice's addItem, so it goes through this.
import { useCallback, useRef, useState } from 'react';
import {
  missingRequiredFields,
  typeIn,
  type CustomFieldDef,
  type ItemFields,
  type ItemTypeDef,
} from '@liveplanner/items';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

export type RequiredFieldsRequest = {
  type: ItemTypeDef;
  // The card's fields as asked for (its title among them).
  fields: ItemFields;
  // What it lacks, in the type's order.
  missing: readonly CustomFieldDef[];
};

export function useRequiredFieldsGate(types: readonly ItemTypeDef[]) {
  const [request, setRequest] = useState<RequiredFieldsRequest | null>(null);
  // The waiting card's answer: its filled fields, or null for Cancel.
  const resolveRef = useRef<((filled: ItemFields | null) => void) | null>(null);
  const typesRef = useLatest(types);

  // The fields to write now, or (a required field missing) a promise of them once the dialog is done: null on
  // Cancel. A second card asked for while one waits cancels the first.
  const fill = useCallback(
    (typeId: string, fields: ItemFields): ItemFields | Promise<ItemFields | null> => {
      const type = typeIn(typesRef.current, typeId);
      const missing = missingRequiredFields(type, fields);
      if (missing.length === 0) return fields;
      resolveRef.current?.(null);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setRequest({ type, fields, missing });
      });
    },
    [typesRef],
  );

  const settle = useCallback((filled: ItemFields | null) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(filled);
  }, []);

  return { request, fill, settle };
}
