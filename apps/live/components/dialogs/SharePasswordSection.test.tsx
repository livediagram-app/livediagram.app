// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharePasswordSection } from './SharePasswordSection';

// The share-password band (docs/specs/013-workspace/share-password.md "Share dialog"). The api keeps
// only a hash, so a saved password is shown as set, never in the clear.

function renderSection(over: Partial<Parameters<typeof SharePasswordSection>[0]> = {}) {
  const props = {
    sharePasswordSet: false,
    onSetPassword: vi.fn(),
    busy: false,
    setBusy: vi.fn(),
    ...over,
  };
  render(<SharePasswordSection {...props} />);
  return props;
}

afterEach(() => cleanup());

describe('SharePasswordSection', () => {
  it('offers an empty field to choose a first password, and saves it', async () => {
    const onSetPassword = vi.fn().mockResolvedValue(true);
    renderSection({ onSetPassword });
    fireEvent.click(screen.getByRole('switch', { name: /Password Protection/ }));
    const field = screen.getByLabelText('Share password') as HTMLInputElement;
    expect(field.value).toBe('');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: 'otter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(onSetPassword).toHaveBeenCalledWith('otter'));
  });

  it('shows a saved password as set, with Replace and Remove, and no field', () => {
    renderSection({ sharePasswordSet: true });
    expect(screen.getByText('Password Set')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
    expect(screen.queryByLabelText('Share password')).toBeNull();
  });

  it('replaces a saved password through an empty field, and Cancel backs out', async () => {
    const onSetPassword = vi.fn().mockResolvedValue(true);
    renderSection({ sharePasswordSet: true, onSetPassword });
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    const field = screen.getByLabelText('Share password') as HTMLInputElement;
    expect(field.value).toBe('');
    expect(field.placeholder).toBe('Choose a new password');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Password Set')).toBeTruthy();
    expect(onSetPassword).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    fireEvent.change(screen.getByLabelText('Share password'), { target: { value: 'badger' } });
    fireEvent.keyDown(screen.getByLabelText('Share password'), { key: 'Enter' });
    await vi.waitFor(() => expect(onSetPassword).toHaveBeenCalledWith('badger'));
  });

  it('Escape backs out of Replace', () => {
    renderSection({ sharePasswordSet: true });
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    fireEvent.keyDown(screen.getByLabelText('Share password'), { key: 'Escape' });
    expect(screen.getByText('Password Set')).toBeTruthy();
  });

  it('removes a saved password, and switching off does the same', async () => {
    const onSetPassword = vi.fn().mockResolvedValue(false);
    renderSection({ sharePasswordSet: true, onSetPassword });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await vi.waitFor(() => expect(onSetPassword).toHaveBeenCalledWith(null));
    cleanup();
    const again = vi.fn().mockResolvedValue(false);
    renderSection({ sharePasswordSet: true, onSetPassword: again });
    fireEvent.click(screen.getByRole('switch', { name: /Password Protection/ }));
    await vi.waitFor(() => expect(again).toHaveBeenCalledWith(null));
  });

  it('keeps showing the password as set when a remove fails', async () => {
    const onSetPassword = vi.fn().mockResolvedValue(undefined);
    renderSection({ sharePasswordSet: true, onSetPassword });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await vi.waitFor(() => expect(onSetPassword).toHaveBeenCalled());
    expect(screen.getByText('Password Set')).toBeTruthy();
  });

  it('keeps a typed replacement when the save fails', async () => {
    const onSetPassword = vi.fn().mockResolvedValue(undefined);
    renderSection({ sharePasswordSet: true, onSetPassword });
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    fireEvent.change(screen.getByLabelText('Share password'), { target: { value: 'badger' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(onSetPassword).toHaveBeenCalled());
    expect((screen.getByLabelText('Share password') as HTMLInputElement).value).toBe('badger');
  });

  // The dialog can open before the share list loads; the switch must catch up
  // with a password that arrives after mount.
  it('turns the switch on when a saved password arrives after it mounts', () => {
    const props = {
      sharePasswordSet: false,
      onSetPassword: vi.fn(),
      busy: false,
      setBusy: vi.fn(),
    };
    const { rerender } = render(<SharePasswordSection {...props} />);
    const toggle = screen.getByRole('switch', { name: /Password Protection/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    rerender(<SharePasswordSection {...props} sharePasswordSet />);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Password Set')).toBeTruthy();
  });

  it('locks setting a new password, but never removing one in force', () => {
    renderSection({ lockedReason: 'Remove it from the Community to set a password.' });
    expect(screen.getByText('Remove it from the Community to set a password.')).toBeTruthy();
    cleanup();
    renderSection({ sharePasswordSet: true, lockedReason: 'Locked.' });
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });
});
