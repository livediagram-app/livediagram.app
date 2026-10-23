import { describe, expect, it } from 'vitest';
import { projectIdFromPath, isEditorPath } from './legacy-editor-path';

// The editor lived at /diagram/<id> before the container became a project
// (docs/specs/016-platform/router-app.md, "Legacy editor route").
describe('projectIdFromPath', () => {
  it('reads the id from the editor path', () => {
    expect(projectIdFromPath('/project/abc-123')).toEqual({ id: 'abc-123', legacy: false });
  });
  it('reads the id from an old /diagram/ path and says so', () => {
    expect(projectIdFromPath('/diagram/abc-123')).toEqual({ id: 'abc-123', legacy: true });
  });
  it('ignores the static placeholder and other paths', () => {
    expect(projectIdFromPath('/project/placeholder')).toEqual({ id: null, legacy: false });
    // A share link's own address names no plan: the code does.
    expect(projectIdFromPath('/project/shared')).toEqual({ id: null, legacy: false });
    expect(projectIdFromPath('/explorer/recent')).toEqual({ id: null, legacy: false });
  });
});

describe('isEditorPath', () => {
  it('matches the editor route and its old name, nothing else', () => {
    for (const p of ['/project', '/project/x', '/diagram', '/diagram/x'])
      expect(isEditorPath(p), p).toBe(true);
    for (const p of ['/projects', '/diagrams/x', '/explorer', '/project-x'])
      expect(isEditorPath(p), p).toBe(false);
  });
});
