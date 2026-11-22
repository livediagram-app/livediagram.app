import { describe, expect, it } from 'vitest';
import { documentIdFromPath, isEditorPath } from './editor-path';

describe('documentIdFromPath', () => {
  it('reads the id from the editor path', () => {
    expect(documentIdFromPath('/document/abc-123')).toBe('abc-123');
  });
  it('ignores the static placeholder and other paths', () => {
    expect(documentIdFromPath('/document/placeholder')).toBeNull();
    expect(documentIdFromPath('/document/shared')).toBeNull();
    expect(documentIdFromPath('/diagram/abc-123')).toBeNull();
    expect(documentIdFromPath('/explorer/recent')).toBeNull();
  });
});

describe('isEditorPath', () => {
  it('matches the editor route, nothing else', () => {
    for (const p of ['/document', '/document/x']) expect(isEditorPath(p), p).toBe(true);
    for (const p of ['/documents', '/diagram/x', '/explorer', '/document-x'])
      expect(isEditorPath(p), p).toBe(false);
  });
});
