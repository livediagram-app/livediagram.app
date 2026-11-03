// Fields a newer liveplanner made (docs/specs/026-plan/item-types.md "Fields from a newer version"): a custom field
// whose kind, or a Calculated field whose calculation, this build does not know. Kept exactly as stored and
// read-only, so a catalogue holding one still opens and a save from here writes it back untouched. Depends on
// item-types.ts alone, so every module may ask.
import { CALCULATIONS, CUSTOM_FIELD_KINDS, type CustomFieldDef } from './item-types';

// The most one newer field's stored JSON may hold: far above any field liveplanner makes today (a Formula's 2,000
// characters the largest), well inside the catalogue's own cap.
export const NEWER_FIELD_MAX_BYTES = 4096;

const knownKind = (kind: unknown): boolean =>
  (CUSTOM_FIELD_KINDS as readonly unknown[]).includes(kind);
const knownCalculation = (calculation: unknown): boolean =>
  (CALCULATIONS as readonly unknown[]).includes(calculation);

// Whether this build can read the field: one it cannot is drawn read-only, never edited, required or worked out.
export function isNewerField(field: Pick<CustomFieldDef, 'kind' | 'calculation'>): boolean {
  return (
    !knownKind(field.kind) || (field.kind === 'calculated' && !knownCalculation(field.calculation))
  );
}

// A stored field this build does not know (`input` holds a non-empty string `kind`), as the catalogue keeps it: a
// copy of everything stored, its checked `id` and trimmed `label` written back. Null when it cannot be copied or is
// larger than NEWER_FIELD_MAX_BYTES.
export function readNewerField(
  input: Readonly<Record<string, unknown>>,
  id: string,
  label: string,
): CustomFieldDef | null {
  let json: string;
  try {
    json = JSON.stringify({ ...input, id, label });
  } catch {
    return null;
  }
  if (new TextEncoder().encode(json).length > NEWER_FIELD_MAX_BYTES) return null;
  return JSON.parse(json) as CustomFieldDef;
}
