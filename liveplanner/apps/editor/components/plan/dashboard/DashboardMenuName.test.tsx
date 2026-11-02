// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { setMenuNameSlot } from '@/components/plan/menu-name-slot';
import { DashboardMenuName } from './DashboardMenuName';

// docs/specs/026-plan/plan-tabs.md "Dashboard tab": the Dashboard's name rides in the menu box.
const tab = { id: 'd', name: 'Q3 Overview', kind: 'dashboard', elements: [] } as unknown as Tab;

afterEach(() => {
  act(() => setMenuNameSlot(null));
  cleanup();
});

function mountSlot() {
  const slot = document.createElement('span');
  document.body.appendChild(slot);
  act(() => setMenuNameSlot(slot));
  return slot;
}

describe('a Dashboard’s name in the menu box', () => {
  it('shows the tab’s name in the box, renamed with a click', () => {
    const slot = mountSlot();
    const onRename = vi.fn();
    render(<DashboardMenuName tab={tab} onRename={onRename} />);
    expect(slot.textContent).toContain('Q3 Overview');
    fireEvent.click(screen.getByText('Q3 Overview'));
    const field = screen.getByRole('textbox', { name: 'Dashboard name' });
    fireEvent.change(field, { target: { value: '  Launch  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Launch');
  });

  it('puts the name back on Escape, and offers no rename to someone who may not edit', () => {
    mountSlot();
    const onRename = vi.fn();
    const { unmount } = render(<DashboardMenuName tab={tab} onRename={onRename} />);
    fireEvent.click(screen.getByText('Q3 Overview'));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Dashboard name' }), { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    unmount();
    render(<DashboardMenuName tab={tab} />);
    fireEvent.click(screen.getByText('Q3 Overview'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('draws nothing while the box has no slot', () => {
    render(<DashboardMenuName tab={tab} />);
    expect(screen.queryByText('Q3 Overview')).toBeNull();
  });

  it('is a button an Editor reaches from the keyboard, focus coming back to it once renamed', () => {
    mountSlot();
    const onRename = vi.fn();
    render(<DashboardMenuName tab={tab} onRename={onRename} />);
    const name = screen.getByRole('button', { name: 'Rename Dashboard Q3 Overview' });
    fireEvent.click(name);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Dashboard name' }), { key: 'Escape' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Rename Dashboard Q3 Overview' }),
    );
  });

  // touch-targets.md "Padding where a pad would be clipped": the name truncates, so it grows by padding (20px to 44px
  // tall) on a touch screen, a negative margin keeping the line where it was.
  it('is 44px tall to a finger without moving', () => {
    mountSlot();
    render(<DashboardMenuName tab={tab} onRename={vi.fn()} />);
    const name = screen.getByRole('button', { name: 'Rename Dashboard Q3 Overview' });
    expect(name.className.split(' ')).toEqual(
      expect.arrayContaining(['pointer-coarse:py-3', 'pointer-coarse:-my-3']),
    );
  });

  it('is plain text to someone who may not edit', () => {
    mountSlot();
    render(<DashboardMenuName tab={tab} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
