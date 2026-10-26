import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import { createApiRefusal, createDeleteRefusal } from './api-refusal';
import { TEST_PRODUCT, WORDED_PRODUCT } from './testing/product';

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

describe('deleteRefusal', () => {
  const deleteRefusal = createDeleteRefusal(TEST_PRODUCT);

  it('says why, by status and what was deleted', () => {
    expect(deleteRefusal(410, false)).toBe('It is already in the Trash (see list_trash).');
    expect(deleteRefusal(403, true)).toBe('You may view this sketch but not change it.');
    expect(deleteRefusal(404, true)).toBe(
      'No such tab in this sketch: read_sketch lists its tabs.',
    );
    expect(deleteRefusal(404, false)).toBe(
      'No such sketch, or it is not yours: find_sketches lists them.',
    );
    expect(deleteRefusal(409, true)).toBe(
      'A sketch must keep at least one tab: you cannot delete the last one.',
    );
    // Any other status is named, never blamed on the last tab.
    expect(deleteRefusal(409, false)).toBe('Check the sketch id and that you own it.');
    expect(deleteRefusal(503, true)).toBe(
      'The api refused it (503): check the sketch and tab ids.',
    );
  });

  it('names the file by the product’s word, and its tools by the noun', () => {
    const worded = createDeleteRefusal(WORDED_PRODUCT);
    expect(worded(404, true)).toBe('No such tab in this drawing: read_sketch lists its tabs.');
    expect(worded(404, false)).toBe(
      'No such drawing, or it is not yours: find_sketches lists them.',
    );
  });
});
