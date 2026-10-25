import { describe, expect, it } from 'vitest';
import { isEditorPath, projectIdFromPath } from './editor-path';

describe('projectIdFromPath', () => {
  it('reads the id from the editor path', () => {
    expect(projectIdFromPath('/project/abc-123')).toBe('abc-123');
  });
  it('ignores the static placeholder and other paths', () => {
    expect(projectIdFromPath('/project/placeholder')).toBeNull();
    // A share link's own address names no plan: the code does.
    expect(projectIdFromPath('/project/shared')).toBeNull();
    expect(projectIdFromPath('/explorer/recent')).toBeNull();
    // liveplanner never served livediagram's /diagram/<id>.
    expect(projectIdFromPath('/diagram/abc-123')).toBeNull();
  });
});

describe('isEditorPath', () => {
  it('matches the editor route, nothing else', () => {
    for (const p of ['/project', '/project/x']) expect(isEditorPath(p), p).toBe(true);
    for (const p of ['/projects', '/diagram/x', '/explorer', '/project-x'])
      expect(isEditorPath(p), p).toBe(false);
  });
});
