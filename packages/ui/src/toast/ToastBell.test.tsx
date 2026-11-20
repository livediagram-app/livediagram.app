// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastBell } from './ToastBell';
import { TOAST_BELL_ATTR } from './toast-collapse';
import {
  readToastHistory,
  recordToast,
  resetToastHistoryForTests,
  setToastHistoryScope,
  settleToast,
} from './toast-history';

// liveworkspace/docs/specs/016-notifications/toasts.md "The footer button" and "The popover".

beforeEach(() => {
  setToastHistoryScope(() => 'doc');
  vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetToastHistoryForTests();
  localStorage.clear();
});

const bell = () => screen.getByRole('button', { name: /^Notifications/ });

describe('ToastBell', () => {
  it('is an icon alone the toasts can find, with no dot while nothing is unseen', () => {
    render(<ToastBell className="host-btn" />);
    expect(bell().getAttribute(TOAST_BELL_ATTR)).toBe('');
    expect(bell().className).toBe('host-btn');
    expect(bell().textContent).toBe('');
    expect(bell().getAttribute('aria-label')).toBe('Notifications');
    expect(bell().getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('shows the dot once a toast left unseen, and opening the list clears it', () => {
    render(<ToastBell className="" />);
    act(() => recordToast({ id: 'a', tone: 'info', message: 'Seen one' }, 'live'));
    act(() => settleToast('a', 'seen'));
    expect(document.querySelector('[data-toast-bell-dot]')).toBeNull();
    act(() => recordToast({ id: 'b', tone: 'error', message: 'Missed one' }, 'missed'));
    expect(document.querySelector('[data-toast-bell-dot]')).not.toBeNull();
    expect(bell().getAttribute('aria-label')).toBe('Notifications, new');
    fireEvent.click(bell());
    expect(bell().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[data-toast-bell-dot]')).toBeNull();
    expect(readToastHistory().every((r) => r.state !== 'missed')).toBe(true);
  });

  it('lists every toast, newest first, read-only, with how long ago', async () => {
    act(() =>
      recordToast({ id: 'a', tone: 'success', message: 'Older' }, 'live', 1_000_000 - 120_000),
    );
    act(() =>
      recordToast({ id: 'b', tone: 'warning', message: 'Newer' }, 'missed', 1_000_000 - 5_000),
    );
    render(<ToastBell className="" />);
    fireEvent.click(bell());
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' });
    const rows = within(dialog).getAllByRole('listitem');
    expect(rows.map((r) => r.getAttribute('data-toast-tone'))).toEqual(['warning', 'success']);
    expect(rows[0]!.textContent).toContain('Newer');
    expect(rows[1]!.textContent).toContain('2 min ago');
    // Read-only: the only button in it is Clear.
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Clear']);
  });

  it('Clear empties the list and closes it; reopened empty, it says so', async () => {
    act(() => recordToast({ id: 'a', tone: 'info', message: 'One' }, 'live'));
    render(<ToastBell className="" />);
    fireEvent.click(bell());
    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(bell());
    expect(await screen.findByText('No notifications yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear' }).hasAttribute('disabled')).toBe(true);
  });

  it('a second press closes it', async () => {
    render(<ToastBell className="" />);
    // Pointing at it starts loading the list.
    fireEvent.pointerEnter(bell());
    fireEvent.click(bell());
    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.click(bell());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
