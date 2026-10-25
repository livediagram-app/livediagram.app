import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import { createApiRefusal } from './api-refusal';
import { TEST_PRODUCT } from './testing/product';

const apiRefusalOf = createApiRefusal(TEST_PRODUCT);

describe('apiRefusalOf', () => {
  it('words the known refusals with the product’s files and tools', () => {
    const refusal = (status: number) => apiRefusalOf(new ApiError(status, '{}'));
    expect(refusal(401)).toEqual({
      code: 'http_401',
      message: 'The api refused it: the token is not accepted: sign in again.',
    });
    expect(refusal(403)?.message).toBe(
      'The api refused it: you may view this sketch but not change it (or not this part of it).',
    );
    expect(refusal(404)?.message).toBe(
      'The api refused it: no such sketch, or it is not shared with you. find_sketches lists them.',
    );
    expect(refusal(410)?.message).toBe(
      'The api refused it: that sketch is in the Trash: restore it with restore_sketch first.',
    );
    expect(refusal(413)?.message).toBe(
      'The api refused it: that is more than the sketch can hold.',
    );
    expect(refusal(429)?.message).toMatch(/^The api refused it: too many calls in the last minute/);
  });

  it('keeps the api’s code, and names an unknown refusal by it', () => {
    expect(apiRefusalOf(new ApiError(404, JSON.stringify({ error: 'not_found' })))?.code).toBe(
      'not_found',
    );
    expect(apiRefusalOf(new ApiError(422, JSON.stringify({ error: 'rejected' })))).toEqual({
      code: 'rejected',
      message: 'The api refused it (rejected).',
    });
  });

  it('is no refusal for a 5xx or anything not from the api', () => {
    expect(apiRefusalOf(new ApiError(503, ''))).toBeNull();
    expect(apiRefusalOf(new TypeError('fetch failed'))).toBeNull();
  });
});
