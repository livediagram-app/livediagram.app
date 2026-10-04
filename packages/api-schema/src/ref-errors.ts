// A ref that names no element, or several (docs/specs/024-agents/document-views.md "Refs"): the same
// codes edit operations refuse a target with, so a front door handles both alike.
import type { EditRejectionCode } from './changesets';

export const TARGET_NOT_FOUND_ERROR = 'target_not_found' satisfies EditRejectionCode;
export const TARGET_AMBIGUOUS_ERROR = 'target_ambiguous' satisfies EditRejectionCode;

// One element a refused ref could have meant.
export type RefCandidate = { ref: string; kind: string; label: string | null };

export type RefErrorBody = {
  error: typeof TARGET_NOT_FOUND_ERROR | typeof TARGET_AMBIGUOUS_ERROR;
  message: string;
  input: string;
  candidates: RefCandidate[];
  // The input is as long as a printed ref and matches several elements now: one was added since the read.
  stale: boolean;
};

export function isRefErrorBody(body: unknown): body is RefErrorBody {
  if (typeof body !== 'object' || body === null) return false;
  const error: unknown = Reflect.get(body, 'error');
  const candidates: unknown = Reflect.get(body, 'candidates');
  return (
    (error === TARGET_NOT_FOUND_ERROR || error === TARGET_AMBIGUOUS_ERROR) &&
    typeof Reflect.get(body, 'message') === 'string' &&
    typeof Reflect.get(body, 'input') === 'string' &&
    Array.isArray(candidates) &&
    candidates.every(isRefCandidate) &&
    typeof Reflect.get(body, 'stale') === 'boolean'
  );
}

function isRefCandidate(value: unknown): value is RefCandidate {
  if (typeof value !== 'object' || value === null) return false;
  const label: unknown = Reflect.get(value, 'label');
  return (
    typeof Reflect.get(value, 'ref') === 'string' &&
    typeof Reflect.get(value, 'kind') === 'string' &&
    (label === null || typeof label === 'string')
  );
}
