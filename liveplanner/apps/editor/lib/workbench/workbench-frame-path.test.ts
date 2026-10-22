import { describe, expect, it } from 'vitest';
import { isWorkspaceFramePath, WORKSPACE_FRAME_PAGE } from './workbench-frame-path';

describe('isWorkspaceFramePath', () => {
  it.each([
    '/embed/workbench/explorer/folder/f1',
    '/embed/workbench/explorer/recent',
    '/embed/workbench/explorer/',
    '/embed/workbench/project/doc-1',
    '/embed/workbench/project',
  ])('serves %s from the frame page', (path) => {
    expect(isWorkspaceFramePath(path)).toBe(true);
  });

  it.each([WORKSPACE_FRAME_PAGE, '/embed/workbench', '/embed', '/explorer/recent', '/project/d1'])(
    'leaves %s to its own file',
    (path) => {
      expect(isWorkspaceFramePath(path)).toBe(false);
    },
  );
});
