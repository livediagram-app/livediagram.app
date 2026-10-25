import { describe, expect, it } from 'vitest';
import { DOCUMENT_FORMAT, DOCUMENT_FORMAT_HEADER } from './document-format';

// docs/specs/016-platform/new-version-prompt.md "The document format number".
describe('the document format number', () => {
  it('is 2, packed stroke points, carried in one header', () => {
    expect(DOCUMENT_FORMAT).toBe(2);
    expect(DOCUMENT_FORMAT_HEADER).toBe('X-Livedocuments-Format');
  });
});
