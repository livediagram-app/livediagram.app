// A live form is locked (docs/specs/030-forms/forms.md "Publishing and the form link", "Agents"; blueprint §15):
// while it takes responses only its settings may change, as they never change what a response means.
import type { FormDefinition } from './model';

// The settings a live form keeps open to change.
export const SETTINGS_KEYS = ['closesAt', 'limit', 'confirmation', 'closedMessage'] as const;

function withoutSettings(form: FormDefinition): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...form };
  for (const key of SETTINGS_KEYS) delete rest[key];
  return rest;
}

// Stable JSON: keys sorted at every level, so two forms alike apart from key order read alike.
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

// Whether `after` changes anything about `before` but its settings.
export function changesBeyondSettings(before: FormDefinition, after: FormDefinition): boolean {
  return stable(withoutSettings(before)) !== stable(withoutSettings(after));
}
