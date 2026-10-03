import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_OPEN_HEADER,
  HOME_REJECTIONS,
  HOME_VERBS,
  isHomeRejection,
  readDocumentOpen,
} from './home';

// Explorer Home's wire (docs/specs/013-workspace/explorer-home.md): the api answers these tokens
// and verbs, the editor reads them, so both take them from one place.
describe('home rejections', () => {
  it('names every refusal the blueprint lists', () => {
    expect([...HOME_REJECTIONS].sort()).toEqual(['cursor_invalid', 'limit_invalid', 'tz_invalid']);
  });

  it('recognises a home token and nothing else', () => {
    expect(isHomeRejection('tz_invalid')).toBe(true);
    expect(isHomeRejection('bad_request')).toBe(false);
    expect(isHomeRejection(null)).toBe(false);
  });
});

describe('home verbs', () => {
  it('runs in the order a sentence names them', () => {
    expect(HOME_VERBS).toEqual([
      'commented',
      'replied',
      'resolved',
      'edited',
      'assigned_you',
      'assigned',
      'completed',
      'shared',
    ]);
  });
});

describe('the open marker', () => {
  it('is one header with one value', () => {
    expect(DOCUMENT_OPEN_HEADER).toBe('X-Document-Open');
    expect(readDocumentOpen('1')).toBe(true);
  });

  it('reads anything else as not an open', () => {
    expect(readDocumentOpen(null)).toBe(false);
    expect(readDocumentOpen('true')).toBe(false);
    expect(readDocumentOpen('')).toBe(false);
  });
});
