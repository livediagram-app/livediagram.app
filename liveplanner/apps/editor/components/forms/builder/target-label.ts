// What a question's Answer Goes To chip says (docs/specs/030-forms/forms.md "Mapping: where an answer goes").
import type { ResolvedTarget } from '@liveplanner/forms';

export function targetLabel(target: ResolvedTarget): string {
  if (target.broken) return 'Description (its field was removed)';
  if (target.to === 'title') return 'Title';
  if (target.to === 'field') return target.field?.label ?? 'A field';
  return 'Description';
}
