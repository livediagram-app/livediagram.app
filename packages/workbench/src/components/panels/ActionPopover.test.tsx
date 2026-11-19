// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { ElementAction } from '@liveworkspace/element-model/element-action';
import { ActionPopover } from './ActionPopover';

// The assigned action's card every editor shares (docs/specs/012-collaboration/assigned-actions.md §3): a dialog a
// screen reader can name, with no second banner landmark inside it, anchored beside its element, and its footer's
// Complete, Won't Do, Reopen, Edit and two-step Delete.

const action: ElementAction = {
  id: 'act',
  name: 'Confirm the budget',
  description: '',
  assignee: { userId: 'u1', name: 'Sam Lee' },
  teamId: null,
  assignerId: 'u2',
  assignerName: 'Ann',
  status: 'open',
  createdAt: Date.now(),
  updatedAt: 0,
};

type Props = ComponentProps<typeof ActionPopover>;
let calls: Record<
  'onComplete' | 'onReopen' | 'onEdit' | 'onDelete' | 'onClose',
  ReturnType<typeof vi.fn<() => void>>
>;

// The element the card anchors to, at a given box.
function anchor(rect: { left: number; right: number; top: number }) {
  const node = document.createElement('div');
  node.dataset.elementId = 'a';
  node.getBoundingClientRect = () =>
    ({ ...rect, bottom: rect.top + 40, width: rect.right - rect.left, height: 40 }) as DOMRect;
  document.body.appendChild(node);
}

const popover = (over: Partial<Props> = {}) =>
  render(<ActionPopover elementId="a" action={action} selfUserId={null} {...calls} {...over} />);

const dialog = () => screen.getByRole('dialog', { name: 'Action' });

beforeEach(() => {
  calls = {
    onComplete: vi.fn(),
    onReopen: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('ActionPopover', () => {
  it('is a dialog named by its title, with no banner landmark inside', () => {
    anchor({ left: 100, right: 200, top: 100 });
    popover();
    expect(dialog().querySelector('header')).toBeNull();
    expect(screen.getByRole('button', { name: 'Close action' }).className).toContain(
      'touch-target-y',
    );
  });

  it('sits to the right of its element, and flips left where there is no room', () => {
    anchor({ left: 100, right: 200, top: 100 });
    const { unmount } = popover();
    expect(dialog().style.left).toBe('212px');
    expect(dialog().style.top).toBe('100px');
    unmount();
    document.body.innerHTML = '';
    anchor({ left: 1000, right: 1100, top: -20 });
    popover();
    expect(dialog().style.left).toBe(`${1000 - 12 - 288}px`);
    expect(Number.parseFloat(dialog().style.top)).toBeGreaterThan(0);
  });

  it('draws nothing while its element is not on the page', () => {
    popover();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names the assignee and the assigner, or "you" and nobody', () => {
    anchor({ left: 100, right: 200, top: 100 });
    const { unmount } = popover({
      action: {
        ...action,
        description: 'Before Friday',
        assignee: { userId: 'u1', name: 'Sam Lee', color: '#ef4444' },
      },
    });
    expect(screen.getByText('Assigned to Sam Lee')).toBeTruthy();
    expect(screen.getByText(/by Ann · just now/)).toBeTruthy();
    expect(screen.getByText('Before Friday')).toBeTruthy();
    expect(screen.getByTestId('assignee-disc').style.getPropertyValue('--identity')).toBe(
      '#ef4444',
    );
    unmount();
    popover({
      selfUserId: 'u1',
      action: { ...action, assignee: { userId: 'u1', name: '  ' }, assignerName: null },
    });
    expect(screen.getByText('Assigned to you')).toBeTruthy();
    expect(screen.getByText('just now')).toBeTruthy();
    // No name kept: "Teammate", drawn by its initials.
    expect(screen.getByTestId('assignee-disc').textContent).toMatch(/^T/);
  });

  it('completes an open action, closes it as Won’t Do, and edits it', () => {
    anchor({ left: 100, right: 200, top: 100 });
    const onWontDo = vi.fn();
    popover({ onWontDo });
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(calls.onComplete).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Won’t Do' }));
    expect(onWontDo).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Edit action' }));
    expect(calls.onEdit).toHaveBeenCalledOnce();
  });

  it('offers no Won’t Do where the editor hands in none', () => {
    anchor({ left: 100, right: 200, top: 100 });
    popover();
    expect(screen.queryByRole('button', { name: 'Won’t Do' })).toBeNull();
  });

  it('reopens a done or Won’t Do action, each wearing its badge', () => {
    anchor({ left: 100, right: 200, top: 100 });
    const { unmount } = popover({ action: { ...action, status: 'done' } });
    expect(screen.getByText('Done')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(calls.onReopen).toHaveBeenCalledOnce();
    unmount();
    popover({ action: { ...action, status: 'wont-do' } });
    expect(screen.getByText('Won’t Do')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
  });

  it('deletes in two steps', () => {
    anchor({ left: 100, right: 200, top: 100 });
    popover();
    fireEvent.click(screen.getByRole('button', { name: 'Delete action' }));
    expect(calls.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(calls.onDelete).toHaveBeenCalledOnce();
  });

  it('shows a read-only session the card without its footer', () => {
    anchor({ left: 100, right: 200, top: 100 });
    popover({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit action' })).toBeNull();
  });

  it('opens the Actions board where the editor has one (liveplanner)', () => {
    anchor({ left: 100, right: 200, top: 100 });
    const onOpenBoard = vi.fn();
    const { unmount } = popover({ onOpenBoard });
    fireEvent.click(screen.getByRole('button', { name: 'View on Board' }));
    expect(onOpenBoard).toHaveBeenCalledOnce();
    unmount();
    popover();
    expect(screen.queryByRole('button', { name: 'View on Board' })).toBeNull();
  });

  it('closes from its button and on Escape, and keeps its pointer presses to itself', () => {
    anchor({ left: 100, right: 200, top: 100 });
    popover();
    fireEvent.click(screen.getByRole('button', { name: 'Close action' }));
    expect(calls.onClose).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(calls.onClose).toHaveBeenCalledTimes(2);
    const outer = vi.fn();
    document.addEventListener('pointerdown', outer);
    fireEvent.pointerDown(dialog());
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener('pointerdown', outer);
  });
});
