// The building blocks of runtime element validation (validate.ts, validate-shape.ts): value
// predicates, and the named issue a failed check reports (docs/specs/024-agents/blueprints/
// edit-operations.md "invalid_result" names the field and the rule).

export type ElementValidationIssue = { field: string; rule: string };

// An optional field's check: absent passes; present must satisfy `valid`, else `rule` is reported.
export type FieldCheck = {
  field: string;
  valid: (value: unknown) => boolean;
  rule: string;
};

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isNonEmptyStr(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

export function boundedArray(v: unknown, max: number): v is unknown[] {
  return Array.isArray(v) && v.length <= max;
}

export const issue = (field: string, rule: string): ElementValidationIssue => ({ field, rule });

export const arrayRule = (max: number, of?: string) =>
  `an array of at most ${max} ${of ?? 'items'}`;

export const oneOfRule = (values: readonly string[]) => `one of ${values.join(', ')}`;

export const stringRule = (max: number) => `a string of at most ${max} characters`;

// The first present field that fails its check, in table order.
export function firstFieldIssue(
  el: Record<string, unknown>,
  checks: readonly FieldCheck[],
): ElementValidationIssue | null {
  for (const { field, valid, rule } of checks) {
    const value = el[field];
    if (value !== undefined && !valid(value)) return issue(field, rule);
  }
  return null;
}
