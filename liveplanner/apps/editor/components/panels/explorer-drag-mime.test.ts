import { describe, expect, it, vi } from 'vitest';
import {
  PROJECT_DRAG_MIME,
  FOLDER_DRAG_MIME,
  explorerDragKind,
  folderDragProps,
} from './explorer-drag-mime';

// docs/specs/013-workspace/explorer-structure.md "Dragging to the Trash": a folder drags under its own type, only the
// reader's own and never mid-rename; a drag is read as a project, a folder or neither from its types.

describe('folderDragProps', () => {
  it("makes one of the reader's own folders a drag source carrying its id under the folder type", () => {
    const props = folderDragProps({ id: 'f1', teamId: null }, false);
    expect(props.draggable).toBe(true);
    const setData = vi.fn();
    const dataTransfer = { setData, effectAllowed: 'none' } as unknown as DataTransfer;
    props.onDragStart!({ dataTransfer } as React.DragEvent);
    expect(setData).toHaveBeenCalledWith(FOLDER_DRAG_MIME, 'f1');
    expect(dataTransfer.effectAllowed).toBe('move');
  });

  it("drags neither a team's folder nor one being renamed", () => {
    expect(folderDragProps({ id: 'f1', teamId: 't1' }, false)).toEqual({});
    expect(folderDragProps({ id: 'f1', teamId: null }, true)).toEqual({});
  });
});

describe('explorerDragKind', () => {
  it('reads a project, a folder, or neither', () => {
    expect(explorerDragKind([PROJECT_DRAG_MIME])).toBe('project');
    expect(explorerDragKind([FOLDER_DRAG_MIME])).toBe('folder');
    expect(explorerDragKind(['text/plain', 'Files'])).toBeNull();
  });
});
