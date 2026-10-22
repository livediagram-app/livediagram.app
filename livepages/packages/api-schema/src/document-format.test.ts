import { describe, expect, it } from 'vitest';
import { DOCUMENT_FORMAT, DOCUMENT_FORMAT_HEADER, parseDocumentFormat } from './document-format';

// docs/specs/016-platform/new-version-prompt.md "The document format number".
describe('the document format number', () => {
  it('is 2, packed stroke points, carried in one header', () => {
    expect(DOCUMENT_FORMAT).toBe(2);
    expect(DOCUMENT_FORMAT_HEADER).toBe('X-Livediagram-Format');
  });

  it.each([
    [2, 2],
    ['3', 3],
    [' 4 ', null],
    [0, null],
    [-1, null],
    [1.5, null],
    ['2a', null],
    ['', null],
    [null, null],
    [undefined, null],
    [Number.MAX_SAFE_INTEGER + 1, null],
    [{}, null],
  ])('parses %j as %j', (value, expected) => {
    expect(parseDocumentFormat(value)).toBe(expected);
  });
});
