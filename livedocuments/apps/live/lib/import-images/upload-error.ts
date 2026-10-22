// An upload rejection to a named import failure
// (docs/specs/020-import-export/blueprints/import-image-pipeline.md "failureFromUploadError").

import { ApiError } from '../api/core';
import type { ImportImageFailure } from './types';

const BY_CODE: Record<string, ImportImageFailure> = {
  gallery_full: 'gallery-full',
  unsupported_type: 'unsupported',
  malformed_jpeg: 'unsupported',
  file_too_large: 'too-large',
  images_unavailable: 'images-unavailable',
};

const BY_STATUS: Record<number, ImportImageFailure> = {
  503: 'images-unavailable',
  413: 'too-large',
  415: 'unsupported',
};

export function failureFromUploadError(error: unknown): ImportImageFailure {
  if (!(error instanceof ApiError)) return 'upload-failed';
  return (error.code && BY_CODE[error.code]) || BY_STATUS[error.status] || 'upload-failed';
}
