// @vitest-environment jsdom

// A Room's name field (docs/specs/009-elements/office.md "Room name field"): the stored label, saved on blur or Enter
// as the canvas's in-place rename, Escape puts it back, an unchanged name saves nothing, Editors only.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { ROOM_NAME_MAX, RoomNameField, roomNameEditable } from './RoomNameField';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

const room = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('room', 0, 0), id: 'room', label: 'Kitchen', ...over }) as ShapeElement;
const field = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Room name' });

function showField(target: ShapeElement) {
  const onRename = vi.fn();
  const view = render(<RoomNameField room={target} onRename={onRename} />);
  return {
    onRename,
    rerender: (next: ShapeElement) =>
      view.rerender(<RoomNameField room={next} onRename={onRename} />),
  };
}

describe('RoomNameField', () => {
  it('shows the stored name, capped, with Room as its placeholder', () => {
    showField(room());
    expect(field().value).toBe('Kitchen');
    expect(field().placeholder).toBe('Room');
    expect(field().maxLength).toBe(ROOM_NAME_MAX);
  });

  it('saves on blur and on Enter, through the rename it is given', () => {
    const { onRename } = showField(room());
    fireEvent.change(field(), { target: { value: 'Studio' } });
    expect(onRename).not.toHaveBeenCalled();
    fireEvent.blur(field());
    expect(onRename).toHaveBeenLastCalledWith('room', 'Studio');
    fireEvent.change(field(), { target: { value: 'Studio B' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onRename).toHaveBeenLastCalledWith('room', 'Studio B');
  });

  it('saves nothing when the name is unchanged or only padded', () => {
    const { onRename } = showField(room());
    fireEvent.blur(field());
    fireEvent.change(field(), { target: { value: '  Kitchen ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
  });

  it('clears the name when emptied', () => {
    const { onRename } = showField(room());
    fireEvent.change(field(), { target: { value: '' } });
    fireEvent.blur(field());
    expect(onRename).toHaveBeenLastCalledWith('room', '');
  });

  it('puts the stored name back on Escape, and keeps the key from the menu and the canvas', () => {
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    const { onRename } = showField(room());
    fireEvent.change(field(), { target: { value: 'Typo' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(field().value).toBe('Kitchen');
    fireEvent.keyDown(field(), { key: 'k' });
    expect(outside).not.toHaveBeenCalled();
    fireEvent.blur(field());
    expect(onRename).not.toHaveBeenCalled();
    document.removeEventListener('keydown', outside);
  });

  it('follows the stored name when it changes elsewhere (an undo, a peer)', () => {
    const { rerender } = showField(room());
    rerender(room({ label: 'Library' }));
    expect(field().value).toBe('Library');
  });
});

describe('roomNameEditable', () => {
  const can = (level: 'edit' | 'participate' | 'view') =>
    resolveEditorCapabilities({ level, adderKey: null });

  it('is an Editor’s alone, and only on a room', () => {
    expect(roomNameEditable(can('edit'), room())).toBe(true);
    expect(roomNameEditable(can('participate'), room())).toBe(false);
    expect(roomNameEditable(can('view'), room())).toBe(false);
    expect(roomNameEditable(can('edit'), { ...room(), shape: 'rug' })).toBe(false);
  });
});

// The room's settings dialog, opened from its menu row: Name first, when the host passes the rename.
describe('the Room settings dialog', () => {
  function openDialog(onRenameRoom: EditorContextMenuProps['onRenameRoom']) {
    const target = room({ roomDoor: 'none' });
    const given: Record<string, unknown> = {
      menu: { mode: 'element', elementId: target.id, x: 10, y: 10, tools: true },
      elements: [target],
      onRenameRoom,
    };
    const props = new Proxy(given, {
      get: (t, k: string) => (k in t ? t[k] : vi.fn()),
      has: () => true,
    }) as unknown as EditorContextMenuProps;
    const Host = () => EditorContextMenu(props);
    render(<Host />);
  }

  it('leads with the Room name field and renames through it', () => {
    const onRenameRoom = vi.fn();
    openDialog(onRenameRoom);
    const sections = [...document.querySelectorAll('[data-menu-section]')].map((n) =>
      n.getAttribute('data-menu-section'),
    );
    expect(sections.slice(0, 3)).toEqual(['Name', 'Walls', 'Floor']);
    fireEvent.change(field(), { target: { value: 'Boardroom' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onRenameRoom).toHaveBeenCalledWith('room', 'Boardroom');
  });

  it('has no Name section where the host passes no rename', () => {
    openDialog(undefined);
    expect(screen.queryByRole('textbox', { name: 'Room name' })).toBeNull();
    expect(document.querySelector('[data-menu-section="Name"]')).toBeNull();
  });
});
