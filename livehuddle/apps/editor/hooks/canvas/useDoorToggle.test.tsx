// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { useDoorToggle } from './useDoorToggle';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/009-elements/room-builder.md "Opening and closing": the click policy's one call.
const door = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'd',
    type: 'shape',
    shape: 'door',
    x: 0,
    y: -12,
    width: 96,
    height: 24,
    ...extra,
  }) as unknown as Element;
const chair = {
  id: 'c',
  type: 'shape',
  shape: 'chair',
  x: 0,
  y: 0,
  width: 40,
  height: 40,
} as unknown as Element;

function setup(level: 'edit' | 'participate' | 'view', elements: Element[], blocked = false) {
  let tab = elements;
  const commit = vi.fn((map: (els: Element[]) => Element[]) => {
    tab = map(tab);
  });
  const can = resolveEditorCapabilities({ level, adderKey: 'a'.repeat(32) });
  const { result } = renderHook(() =>
    useDoorToggle({ elements, canSwing: can.swingDoor, blocked, commit }),
  );
  return { toggleDoor: result.current.toggleDoor, commit, tab: () => tab };
}

describe('toggleDoor', () => {
  it('closes an open door in one commit, and opens a closed one', () => {
    const editor = setup('edit', [chair, door()]);
    expect(editor.toggleDoor('d')).toBe(true);
    expect(editor.commit).toHaveBeenCalledTimes(1);
    expect(editor.tab()[1]).toMatchObject({ doorClosed: true });
    expect(editor.tab()[0]).toBe(chair);
    const shut = setup('participate', [door({ doorClosed: true })]);
    expect(shut.toggleDoor('d')).toBe(true);
    expect(shut.tab()[0]).not.toHaveProperty('doorClosed');
  });

  it('lets a Participant swing an unlocked door, not a locked one', () => {
    expect(setup('participate', [door()]).toggleDoor('d')).toBe(true);
    const locked = setup('participate', [door({ locked: true })]);
    expect(locked.toggleDoor('d')).toBe(false);
    expect(locked.commit).not.toHaveBeenCalled();
  });

  it('lets a Viewer swing nothing, and swings nothing that is not a door or on a blocked tab', () => {
    const viewer = setup('view', [door()]);
    expect(viewer.toggleDoor('d')).toBe(false);
    expect(viewer.commit).not.toHaveBeenCalled();
    expect(setup('edit', [chair]).toggleDoor('c')).toBe(false);
    expect(setup('edit', [door()]).toggleDoor('gone')).toBe(false);
    expect(setup('edit', [door()], true).toggleDoor('d')).toBe(false);
  });
});
