import { describe, expect, it } from 'vitest';
import { SUGGESTIONS_OPENAPI } from './openapi';
import { SUGGESTION_MAX_OPS } from './suggestion';

describe('SUGGESTIONS_OPENAPI', () => {
  it('documents each route with its limits', () => {
    expect(Object.keys(SUGGESTIONS_OPENAPI)).toEqual(['list', 'submit', 'accept', 'reject']);
    expect(SUGGESTIONS_OPENAPI.submit.summary).toContain(String(SUGGESTION_MAX_OPS));
    expect(SUGGESTIONS_OPENAPI.accept.statuses).toContain(409);
  });
});
