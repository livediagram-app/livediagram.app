// The field a refused write names and the limit its value broke (docs/specs/026-plan/items.md "Limits"), carried on
// the error lib/api/items.ts throws so the toast can name the field as the card shows it.
import type { FieldLimit } from '@liveplanner/items';

export type RefusedField = { field?: string; limit?: FieldLimit };

export function refusedFieldOf(err: unknown): RefusedField {
  const { field, limit } = (err ?? {}) as RefusedField;
  return {
    ...(typeof field === 'string' && field ? { field } : {}),
    ...(limit ? { limit } : {}),
  };
}
