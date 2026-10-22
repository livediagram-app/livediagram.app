import { describe, expect, it } from 'vitest';
import { documentIdFromPath, isEditorPath } from './legacy-editor-path';

// The editor lived at /diagram/<id> before the container became a document
// (docs/specs/016-platform/router-app.md, "Legacy editor route").
describe('documentIdFromPath', () => {
  it('reads the id from the editor path', () => {
    expect(documentIdFromPath('/document/abc-123')).toEqual({ id: 'abc-123', legacy: false });
  });
  it('reads the id from an old /diagram/ path and says so', () => {
    expect(documentIdFromPath('/diagram/abc-123')).toEqual({ id: 'abc-123', legacy: true });
  });
  it('ignores the static placeholder and other paths', () => {
    expect(documentIdFromPath('/document/placeholder')).toEqual({ id: null, legacy: false });
    expect(documentIdFromPath('/explorer/recent')).toEqual({ id: null, legacy: false });
  });
});

describe('isEditorPath', () => {
  it('matches the editor route and its old name, nothing else', () => {
    for (const p of ['/document', '/document/x', '/diagram', '/diagram/x'])
      expect(isEditorPath(p), p).toBe(true);
    for (const p of ['/documents', '/diagrams/x', '/explorer', '/document-x'])
      expect(isEditorPath(p), p).toBe(false);
  });
});
