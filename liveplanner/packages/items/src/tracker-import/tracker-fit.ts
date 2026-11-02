// A card's fields fit the card's size (docs/specs/026-plan/tracker-import.md "Fields"): an imported card may carry a
// long description and a full checklist that together pass ITEM_FIELDS_BYTES. The description is shortened first,
// then checklist rows go from the end, until the fields are valid.
import { fieldsWithinBounds, validateFields } from '../fields';
import type { ItemFields } from '../item';
import { cutText } from './tracker-text';

export type FieldsFit = { fields: ItemFields; shortened: boolean } | null;

// As the api reads a create's fields (write-checks.ts readItemCreate): each value, then their count and size.
function valid(fields: ItemFields): ReturnType<typeof validateFields> {
  const read = validateFields(fields, 'create');
  if (!read.ok) return read;
  const bound = fieldsWithinBounds(read.fields);
  return bound ? { ok: false, error: bound } : read;
}

// The longest description, by halving, that keeps `fields` within their size.
function fittedDescription(fields: ItemFields, text: string): string {
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const ok = valid({ ...fields, description: cutText(text, mid) }).ok;
    if (ok) lo = mid;
    else hi = mid - 1;
  }
  return cutText(text, lo);
}

// `fields` as a create keeps them, shortened when too large; null when they are refused for any other reason.
export function fitFields(input: ItemFields): FieldsFit {
  const first = valid(input);
  if (first.ok) return { fields: first.fields, shortened: false };
  if (first.error !== 'fields_too_large') return null;
  let fields: ItemFields = { ...input };
  const description = typeof fields['description'] === 'string' ? fields['description'] : '';
  if (description) {
    const { description: _drop, ...rest } = fields;
    const without = valid(rest);
    if (without.ok) {
      const kept = fittedDescription(rest, description);
      fields = kept ? { ...rest, description: kept } : rest;
      const fitted = valid(fields);
      if (fitted.ok) return { fields: fitted.fields, shortened: true };
    }
    fields = rest;
  }
  const rows = Array.isArray(fields['checklist']) ? [...fields['checklist']] : [];
  while (rows.length > 0) {
    rows.pop();
    const next: ItemFields = rows.length
      ? { ...fields, checklist: rows }
      : withoutChecklist(fields);
    const fitted = valid(next);
    if (fitted.ok) return { fields: fitted.fields, shortened: true };
  }
  return null;
}

function withoutChecklist(fields: ItemFields): ItemFields {
  const { checklist: _drop, ...rest } = fields;
  return rest;
}
