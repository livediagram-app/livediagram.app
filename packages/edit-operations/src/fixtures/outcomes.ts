// Outcome readers for the suites: the success or the single refusal, failing the test otherwise.

import type { EditRejection } from '@livediagram/api-schema';
import { expect } from 'vitest';
import { formatResultLines } from '../format-results';
import type { ApplyOutcome, ApplySuccess } from '../types';

export function applied(outcome: ApplyOutcome): ApplySuccess {
  expect(outcome).not.toHaveProperty('errors');
  return outcome as ApplySuccess;
}

export function refused(outcome: ApplyOutcome): EditRejection {
  expect(outcome).toHaveProperty('errors');
  return (outcome as { errors: EditRejection[] }).errors[0]!;
}

// The result lines as the answer prints them.
export const lines = (outcome: ApplyOutcome) => formatResultLines(applied(outcome).results);
