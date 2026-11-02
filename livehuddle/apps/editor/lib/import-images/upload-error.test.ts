import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/core';
import { failureFromUploadError } from './upload-error';

describe('failureFromUploadError', () => {
  it.each([
    ['gallery_full', 403, 'gallery-full'],
    ['unsupported_type', 415, 'unsupported'],
    ['malformed_jpeg', 415, 'unsupported'],
    ['file_too_large', 413, 'too-large'],
    ['images_unavailable', 503, 'images-unavailable'],
  ] as const)('maps the %s token', (code, status, failure) => {
    expect(failureFromUploadError(new ApiError('upload image', status, code))).toBe(failure);
  });

  it.each([
    [503, 'images-unavailable'],
    [413, 'too-large'],
    [415, 'unsupported'],
    [500, 'upload-failed'],
    [401, 'upload-failed'],
  ] as const)('falls back on the %s status without a token', (status, failure) => {
    expect(failureFromUploadError(new ApiError('upload image', status, null))).toBe(failure);
  });

  it('treats a network error as upload-failed', () => {
    expect(failureFromUploadError(new TypeError('Failed to fetch'))).toBe('upload-failed');
  });
});
