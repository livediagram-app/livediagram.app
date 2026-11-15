import { describe, expect, it } from 'vitest';
import { documentIdFromPath, isEditorPath } from './editor-path';

describe('documentIdFromPath', () => {
  it('reads the id from the editor path', () => {
    expect(documentIdFromPath('/document/abc-123')).toBe('abc-123');
  });
  it('reads no id from the old /diagram/ path, which the router redirects', () => {
    expect(documentIdFromPath('/diagram/abc-123')).toBeNull();
  });
  it('ignores the static placeholder and other paths', () => {
    expect(documentIdFromPath('/document/placeholder')).toBeNull();
    expect(documentIdFromPath('/explorer/recent')).toBeNull();
  });
});

describe('isEditorPath', () => {
  it('matches the editor route, nothing else', () => {
    for (const p of ['/document', '/document/x']) expect(isEditorPath(p), p).toBe(true);
    for (const p of ['/documents', '/diagram', '/diagram/x', '/explorer', '/document-x'])
      expect(isEditorPath(p), p).toBe(false);
  });
});
