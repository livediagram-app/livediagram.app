import { describe, expect, it } from 'vitest';
import { isWorkspaceFramePath, WORKSPACE_FRAME_PAGE } from './workbench-frame-path';

describe('isWorkspaceFramePath', () => {
  it.each([
    '/embed/workbench/explorer/folder/f1',
    '/embed/workbench/explorer/recent',
    '/embed/workbench/explorer/',
    '/embed/workbench/design/doc-1',
    '/embed/workbench/design',
  ])('serves %s from the frame page', (path) => {
    expect(isWorkspaceFramePath(path)).toBe(true);
  });

  it.each([WORKSPACE_FRAME_PAGE, '/embed/workbench', '/embed', '/explorer/recent', '/design/d1'])(
    'leaves %s to its own file',
    (path) => {
      expect(isWorkspaceFramePath(path)).toBe(false);
    },
  );
});
