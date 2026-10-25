import { describe, expect, it } from 'vitest';
import { designIdFromPath, isEditorPath } from './legacy-editor-path';

// The editor lived at /diagram/<id> before the container became a design
// (docs/specs/016-platform/router-app.md, "Legacy editor route").
describe('designIdFromPath', () => {
  it('reads the id from the editor path', () => {
    expect(designIdFromPath('/design/abc-123')).toEqual({ id: 'abc-123', legacy: false });
  });
  it('reads the id from an old /diagram/ path and says so', () => {
    expect(designIdFromPath('/diagram/abc-123')).toEqual({ id: 'abc-123', legacy: true });
  });
  it('ignores the static placeholder and other paths', () => {
    expect(designIdFromPath('/design/placeholder')).toEqual({ id: null, legacy: false });
    // A share link's own address names no design: the code does.
    expect(designIdFromPath('/design/shared')).toEqual({ id: null, legacy: false });
    expect(designIdFromPath('/explorer/recent')).toEqual({ id: null, legacy: false });
  });
});

describe('isEditorPath', () => {
  it('matches the editor route and its old name, nothing else', () => {
    for (const p of ['/design', '/design/x', '/diagram', '/diagram/x'])
      expect(isEditorPath(p), p).toBe(true);
    for (const p of ['/designs', '/diagrams/x', '/explorer', '/design-x'])
      expect(isEditorPath(p), p).toBe(false);
  });
});
