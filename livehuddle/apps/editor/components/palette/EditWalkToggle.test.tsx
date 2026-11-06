// @vitest-environment jsdom
// The Edit | Walk toggle (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"): the side that is on is
// pressed, a press of the other switches, a press of the side already on does nothing, and Walk greys with its reason
// while something holds the walk, Edit never.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditWalkToggle, editWalkHint } from './EditWalkToggle';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));

afterEach(() => {
  cleanup();
  mobile.value = false;
});

function show(walking: boolean, walkBlockedReason?: string) {
  const onEdit = vi.fn();
  const onWalk = vi.fn();
  render(
    <EditWalkToggle
      walking={walking}
      onEdit={onEdit}
      onWalk={onWalk}
      walkBlockedReason={walkBlockedReason}
    />,
  );
  const group = screen.getByRole('group', { name: 'Edit or Walk' });
  return {
    onEdit,
    onWalk,
    edit: within(group).getByRole('button', { name: 'Edit' }),
    walk: within(group).getByRole('button', { name: 'Walk' }),
  };
}

// The hover card opens at once on a mouse pointer.
function hoverText(button: HTMLElement): string {
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  return document.body.textContent ?? '';
}

describe('EditWalkToggle', () => {
  it('presses Edit while building, and Walk walks', () => {
    const s = show(false);
    expect(s.edit.getAttribute('aria-pressed')).toBe('true');
    expect(s.walk.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(s.walk);
    expect(s.onWalk).toHaveBeenCalledTimes(1);
    expect(s.onEdit).not.toHaveBeenCalled();
  });

  it('presses Walk while walking, and Edit goes back to building', () => {
    const s = show(true);
    expect(s.walk.getAttribute('aria-pressed')).toBe('true');
    expect(s.edit.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(s.edit);
    expect(s.onEdit).toHaveBeenCalledTimes(1);
    expect(s.onWalk).not.toHaveBeenCalled();
  });

  it('does nothing on a press of the side already on', () => {
    const building = show(false);
    fireEvent.click(building.edit);
    expect(building.onEdit).not.toHaveBeenCalled();
    cleanup();
    const walking = show(true);
    fireEvent.click(walking.walk);
    expect(walking.onWalk).not.toHaveBeenCalled();
  });

  it('greys Walk with its reason while the walk is held, and a press does nothing', () => {
    const s = show(false, 'Not over a start');
    expect(s.walk.getAttribute('aria-disabled')).toBe('true');
    // aria-disabled, not disabled, so the pointer still reaches the hover card that says why.
    expect((s.walk as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(s.walk);
    expect(s.onWalk).not.toHaveBeenCalled();
    expect(s.edit.getAttribute('aria-disabled')).toBeNull();
    expect(hoverText(s.walk)).toContain('Not over a start');
  });

  it('never greys Edit: leaving the walk works with a reason set', () => {
    const s = show(true, 'Not over a start');
    expect(s.walk.getAttribute('aria-disabled')).toBeNull();
    expect(s.edit.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(s.edit);
    expect(s.onEdit).toHaveBeenCalledTimes(1);
  });

  it('says what each side does in its hover card, with its key', () => {
    const s = show(false);
    expect(hoverText(s.walk)).toContain(editWalkHint('walk', false));
    expect(s.edit.getAttribute('aria-keyshortcuts')).toBe('E');
    expect(s.walk.getAttribute('aria-keyshortcuts')).toBe('W');
  });

  it('leaves the keys out on a phone', () => {
    mobile.value = true;
    const s = show(false);
    expect(s.edit.getAttribute('aria-keyshortcuts')).toBeNull();
    expect(s.walk.getAttribute('aria-keyshortcuts')).toBeNull();
  });
});

describe('editWalkHint', () => {
  it('names the key on a desktop', () => {
    expect(editWalkHint('edit', false)).toBe('Select and build the board. Shortcut: E.');
    expect(editWalkHint('walk', false)).toBe(
      'Walk round the board as your character. Shortcut: W.',
    );
  });

  it('leaves the key out on a phone', () => {
    expect(editWalkHint('edit', true)).toBe('Select and build the board.');
    expect(editWalkHint('walk', true)).toBe('Walk round the board as your character.');
  });
});
