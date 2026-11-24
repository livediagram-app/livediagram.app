// @vitest-environment jsdom

// A room's Walls in the element menu (docs/specs/009-elements/office.md "Glass walls"): Solid and Glass tiles in the
// element menu of every room, a new Room's and a drawn room's too, not only an older room with a built-in doorway.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { RoomWallsMenuSection } from './CollabMenuSections';
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
  ({ ...createShape('room', 0, 0), id: 'room', ...over }) as ShapeElement;

function openMenu(target: ShapeElement, tools = false) {
  const given: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10, tools },
    elements: [target],
    layers: [],
    theme: undefined,
  };
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  const Host = () => EditorContextMenu(props);
  render(<Host />);
}

function showSection(target: ShapeElement | undefined) {
  const onSetWalls = vi.fn();
  render(
    <RoomWallsMenuSection
      target={target}
      sectionProps={() => ({ open: true, onToggle: () => {} })}
      onSetWalls={onSetWalls}
    />,
  );
  return onSetWalls;
}

const tile = (name: string) =>
  screen.getAllByRole('button').find((b) => b.textContent?.trim() === name)!;

// The row that opens the element's own settings in their dialog (MenuToolsSection): there is no Tools flyout.
const settingsRow = () =>
  screen
    .queryAllByRole('button')
    .find(
      (b) =>
        b.getAttribute('aria-haspopup') === 'dialog' &&
        b.getAttribute('data-menu-section') !== 'Resources',
    );

describe('a room’s Walls', () => {
  // A new Room's way in is a Door piece, so it has no doorway section: its own settings are its Walls and its Floor,
  // in the dialog its menu row opens.
  it('has Walls and Floor in a new Room’s settings dialog, opened from its row', () => {
    openMenu(room({ roomDoor: 'none' }));
    expect(tile('Tools')).toBeUndefined();
    expect(settingsRow()).toBeTruthy();
    cleanup();
    openMenu(room({ roomDoor: 'none' }), true);
    const rows = screen.queryAllByRole('button').map((b) => b.textContent?.trim());
    expect(rows).toContain('Walls');
    expect(rows).toContain('Floor');
  });

  it('sets Glass, and back to Solid', () => {
    const onSetWalls = showSection(room());
    fireEvent.click(tile('Glass'));
    expect(onSetWalls).toHaveBeenLastCalledWith('glass');
    fireEvent.click(tile('Solid'));
    expect(onSetWalls).toHaveBeenLastCalledWith('solid');
  });

  it('reads a glass room as Glass, and no room as Solid', () => {
    showSection(room({ variant: 'glass' }));
    expect(tile('Glass').getAttribute('aria-pressed')).toBe('true');
    cleanup();
    showSection(undefined);
    expect(tile('Solid').getAttribute('aria-pressed')).toBe('true');
  });
});
